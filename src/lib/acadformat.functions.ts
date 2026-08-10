import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditFinalDocument, buildFinalDocument } from "./document-build";
import type { DocumentModel, IssueDraft } from "./document-model";
import { getConfig, type InstitutionSelection } from "./institutions";

/** Supabase jsonb columns are typed as Json; app types are structurally compatible. */
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("documents")
      .select("id, file_name, file_type, storage_path")
      .eq("id", data.documentId)
      .single();
    if (error || !row) throw new Error("Document not found.");

    await supabase.from("documents").update({ status: "analyzing", error_message: null }).eq("id", row.id);

    try {
      const download = await supabase.storage.from("documents").download(row.storage_path);
      if (download.error || !download.data) throw new Error("Could not read the uploaded file.");
      const bytes = await download.data.arrayBuffer();

      const { extractDocument } = await import("./extract.server");
      const extracted = await extractDocument(bytes, row.file_type);
      if (extracted.text.trim().length < 200)
        throw new Error("No readable text was found in this file. If it is a scanned PDF, upload the DOCX instead.");

      const { analyzeWithAI } = await import("./ai.server");
      const analysis = await analyzeWithAI({
        text: extracted.text,
        fileName: row.file_name,
        imageCount: extracted.imageCount,
        tableCount: extracted.tableCount,
        institutionHint: "Institution not yet selected — analyse structure generically.",
      });

      await supabase.from("document_issues").delete().eq("document_id", row.id);
      if (analysis.issues.length > 0) {
        await supabase.from("document_issues").insert(
          analysis.issues.map((issue: IssueDraft) => ({
            document_id: row.id,
            user_id: userId,
            category: issue.category,
            location: issue.location,
            problem: issue.problem,
            explanation: issue.explanation,
            suggestion: issue.suggestion,
            confidence: issue.confidence,
            severity: issue.severity,
          })),
        );
      }

      await supabase
        .from("documents")
        .update({
          status: "analyzed",
          raw_text: extracted.text.slice(0, 200_000),
          understanding: toJson(analysis.understanding),
          model: toJson(analysis.model),
          health: toJson(analysis.health),
        })
        .eq("id", row.id);

      return { ok: true as const };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Analysis failed.";
      await supabase.from("documents").update({ status: "failed", error_message: message }).eq("id", row.id);
      throw new Error(message);
    }
  });

export const formatDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string; selection: InstitutionSelection }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("documents")
      .select("id, model")
      .eq("id", data.documentId)
      .single();
    if (error || !row?.model) throw new Error("This document has not been analysed yet.");

    const { data: issues } = await supabase
      .from("document_issues")
      .select("category, location, suggestion, user_value, decision")
      .eq("document_id", row.id);

    const model = applyApprovedCorrections(row.model as unknown as DocumentModel, issues ?? []);
    const config = getConfig(data.selection.configId);
    const final = buildFinalDocument({ model, config, selection: data.selection });
    const audit = auditFinalDocument(final, model);

    await supabase
      .from("documents")
      .update({
        status: "formatted",
        institution: toJson(data.selection),
        model: toJson(model),
        final_document: toJson(final),
        final_audit: toJson(audit),
      })
      .eq("id", row.id);

    return { ok: true as const, audit };
  });

export const exportDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("file_name, final_document, institution")
      .eq("id", data.documentId)
      .single();
    if (error || !row?.final_document) throw new Error("Format the document before exporting.");

    const selection = row.institution as unknown as InstitutionSelection;
    const { buildDocx } = await import("./docx-export.server");
    const base64 = await buildDocx(
      row.final_document as never,
      getConfig(selection?.configId ?? ""),
    );
    return { base64, fileName: row.file_name.replace(/\.(docx|pdf)$/i, "") + " — formatted.docx" };
  });

/** Content-level suggestions only take effect once the user accepts (or edits) them. */
function applyApprovedCorrections(
  model: DocumentModel,
  issues: {
    category: string;
    location: string;
    suggestion: string | null;
    user_value: string | null;
    decision: string;
  }[],
): DocumentModel {
  const approved = issues.filter((i) => i.decision === "accepted" || i.decision === "edited");
  const next: DocumentModel = JSON.parse(JSON.stringify(model));

  for (const issue of approved) {
    const value = (issue.user_value || issue.suggestion || "").trim();
    if (!value) continue;
    const target = issue.location.toLowerCase();

    if (issue.category === "FIGURE") {
      for (const chapter of next.chapters) {
        for (const figure of chapter.figures) {
          if (matches(target, figure.originalLabel, figure.id, figure.caption)) {
            figure.caption = value.replace(/^figure\s*[\d.]*\s*:?\s*/i, "");
            figure.requiresUserReview = false;
          }
        }
      }
    } else if (issue.category === "TABLE") {
      for (const chapter of next.chapters) {
        for (const table of chapter.tables) {
          if (matches(target, table.originalLabel, table.id, table.title)) {
            table.title = value.replace(/^table\s*[\d.]*\s*:?\s*/i, "");
            table.requiresUserReview = false;
          }
        }
      }
    } else if (issue.category === "ABBREVIATION") {
      const abbr = next.abbreviations.find((a) => target.includes(a.abbreviation.toLowerCase()));
      if (abbr) {
        abbr.meaning = value;
        abbr.requiresUserReview = false;
      }
    }
  }

  return next;
}

function matches(target: string, ...candidates: (string | undefined)[]) {
  return candidates.some((candidate) => candidate && target.includes(candidate.toLowerCase()));
}