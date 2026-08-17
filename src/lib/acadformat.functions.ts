import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditFinalDocument, buildFinalDocument } from "./document-build";
import type { DocumentImage, DocumentModel, IssueDraft } from "./document-model";
import { resolveConfig, type InstitutionSelection } from "./institutions";
import { buildDocx, type ImageAsset } from "./docx-export.server";
import { buildPdf } from "./pdf-export.server";
import { extractDocument } from "./extract.server";
import { analyzeWithAI, chatEditDocument } from "./ai.server";
import { restoreVerbatimContent } from "./verbatim";
import { getLogoBytes } from "./static-assets";
import { ensureDocumentsBucket } from "./storage-bootstrap.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Supabase jsonb columns are typed as Json; app types are structurally compatible. */
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { documentId: string }) => data)
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
      await ensureDocumentsBucket();
      const download = await supabaseAdmin.storage.from("documents").download(row.storage_path);
      if (download.error || !download.data) {
        const msg = download.error?.message ?? "Unknown storage error";
        throw new Error(`Could not read the uploaded file: ${msg}. Please re-upload the document.`);
      }
      const bytes = await download.data.arrayBuffer();

      const extracted = await extractDocument(bytes, row.file_type);
      if (extracted.text.trim().length < 200)
        throw new Error("No readable text was found in this file. If it is a scanned PDF, upload the DOCX instead.");

      // Run image uploading and AI analysis concurrently for maximum speed
      const firstChapterAt = extracted.text.search(/chapter\s*(1|one|i\b)/i);
      const uploadImagesTask = Promise.all(
        extracted.images.map(async (image) => {
          const marker = extracted.text.indexOf(`[IMAGE:${image.index}]`);
          const isLogo =
            marker >= 0 && (firstChapterAt < 0 ? marker < 2500 : marker < firstChapterAt) && marker < 4000;
          const ext = image.contentType.includes("jpeg")
            ? "jpg"
            : image.contentType.includes("gif")
              ? "gif"
              : image.contentType.includes("bmp")
                ? "bmp"
                : "png";
          const path = `${userId}/assets/${row.id}/img-${image.index}.${ext}`;
          const binary = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
          let storedPath = path;
          const upload = await supabaseAdmin.storage
            .from("documents")
            .upload(path, binary, { contentType: image.contentType, upsert: true });
          if (upload.error) {
            console.warn(`[storage] Failed to upload image img-${image.index}:`, upload.error.message);
            storedPath = "";
          }
          return {
            id: `img-${image.index}`,
            path: storedPath,
            contentType: image.contentType,
            base64: image.base64,
            role: isLogo ? "logo" : "figure",
          } as DocumentImage;
        })
      );

      const aiTask = analyzeWithAI({
        text: extracted.text,
        fileName: row.file_name,
        imageCount: extracted.imageCount,
        tableCount: extracted.tableCount,
        institutionHint: "Institution not yet selected — analyse structure generically.",
      });

      const [uploadResults, analysis] = await Promise.all([uploadImagesTask, aiTask]);
      const uploadedImages: DocumentImage[] = uploadResults.filter(
        (img): img is DocumentImage => img !== null
      );

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

      const restored = restoreVerbatimContent(analysis.model, extracted.text);
      const analysedModel: DocumentModel = {
        ...restored,
        images: uploadedImages,
        original: extracted.original,
      };

      await supabase
        .from("documents")
        .update({
          status: "analyzed",
          raw_text: extracted.text.slice(0, 200_000),
          understanding: toJson(analysis.understanding),
          model: toJson(analysedModel),
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
  .validator((data: { documentId: string; selection: InstitutionSelection }) => data)
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
    const config = resolveConfig(data.selection);
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
  .validator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("file_name, model, institution")
      .eq("id", data.documentId)
      .single();
    if (error || !row?.model) throw new Error("Format the document before exporting.");

    const selection = row.institution as unknown as InstitutionSelection;
    const model = row.model as unknown as DocumentModel;
    const config = resolveConfig(selection ?? { configId: "" });
    const final = buildFinalDocument({ model, config, selection });

    const images = new Map<string, ImageAsset>();
    for (const image of final.images ?? []) {
      let bytes: Uint8Array | null = null;
      let contentType = image.contentType;

      if (image.path.startsWith("public/") || image.path.startsWith("logo-") || image.id.startsWith("logo-")) {
        const logo = await getLogoBytes(image.id);
        if (logo) {
          bytes = logo.data;
          contentType = logo.contentType;
        }
      } else if (image.path) {
        const file = await supabaseAdmin.storage.from("documents").download(image.path);
        if (!file.error && file.data) {
          bytes = new Uint8Array(await file.data.arrayBuffer());
        }
      }

      if (!bytes && image.base64) {
        bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
      }

      if (bytes) {
        images.set(image.id, {
          data: bytes,
          type: /jpe?g/i.test(contentType)
            ? "jpg"
            : /gif/i.test(contentType)
              ? "gif"
              : /bmp/i.test(contentType)
                ? "bmp"
                : "png",
        });
      }
    }
    const base64 = await buildDocx(
      final as never,
      config,
      images,
    );
    return { base64, fileName: row.file_name.replace(/\.(docx|pdf)$/i, "") + " — formatted.docx" };
  });

export const exportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("file_name, model, institution")
      .eq("id", data.documentId)
      .single();
    if (error || !row?.model) throw new Error("Format the document before exporting.");

    const selection = row.institution as unknown as InstitutionSelection;
    const model = row.model as unknown as DocumentModel;
    const config = resolveConfig(selection ?? { configId: "" });
    const final = buildFinalDocument({ model, config, selection });

    const images = new Map<string, { data: Uint8Array; contentType: string }>();
    for (const image of final.images ?? []) {
      let bytes: Uint8Array | null = null;
      let contentType = image.contentType;

      if (image.path.startsWith("public/") || image.path.startsWith("logo-") || image.id.startsWith("logo-")) {
        const logo = await getLogoBytes(image.id);
        if (logo) {
          bytes = logo.data;
          contentType = logo.contentType;
        }
      } else if (image.path) {
        const file = await supabaseAdmin.storage.from("documents").download(image.path);
        if (!file.error && file.data) {
          bytes = new Uint8Array(await file.data.arrayBuffer());
        }
      }

      if (!bytes && image.base64) {
        bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
      }

      if (bytes) {
        images.set(image.id, {
          data: bytes,
          contentType,
        });
      }
    }
    const base64 = await buildPdf(
      final as never,
      config,
      images,
    );
    return { base64, fileName: row.file_name.replace(/\.(docx|pdf)$/i, "") + " — formatted.pdf" };
  });

/** Signed URLs for the images of the uploaded (pre-formatting) document. */
export const getOriginalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("documents")
      .select("model")
      .eq("id", data.documentId)
      .single();
    const model = row?.model as unknown as DocumentModel | null;
    const urls: Record<string, string> = {};
    for (const image of model?.images ?? []) {
      if (image.path) {
        const signed = await context.supabase.storage
          .from("documents")
          .createSignedUrl(image.path, 60 * 60);
        if (signed.data?.signedUrl) urls[image.id] = signed.data.signedUrl;
      }
      if (!urls[image.id] && image.base64) {
        urls[image.id] = `data:${image.contentType || "image/png"};base64,${image.base64}`;
      }
    }
    return { blocks: model?.original ?? [], urls };
  });

export const getAssetUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { documentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("documents")
      .select("final_document")
      .eq("id", data.documentId)
      .single();
    const final = row?.final_document as unknown as { images?: DocumentImage[] } | null;
    const urls: Record<string, string> = {};
    for (const image of final?.images ?? []) {
      if (image.path.startsWith("public/") || image.path.startsWith("logo-")) {
        urls[image.id] = image.path.startsWith("public/") ? image.path.replace("public/", "/") : `/${image.path}`;
      } else if (image.path) {
        const signed = await context.supabase.storage
          .from("documents")
          .createSignedUrl(image.path, 60 * 60);
        if (signed.data?.signedUrl) urls[image.id] = signed.data.signedUrl;
      }
      if (!urls[image.id] && image.base64) {
        urls[image.id] = `data:${image.contentType || "image/png"};base64,${image.base64}`;
      }
    }
    return { urls };
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

export const chatEditDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      documentId: string;
      message: string;
      selectedText?: string;
      selection: InstitutionSelection;
    }) => data
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("documents")
      .select("id, model")
      .eq("id", data.documentId)
      .single();
    if (error || !row?.model) throw new Error("This document has not been analysed yet.");

    const currentModel = row.model as unknown as DocumentModel;
    const chatInput: any = {
      model: currentModel,
      message: data.message,
    };
    if (data.selectedText) {
      chatInput.selectedText = data.selectedText;
    }
    const result = await chatEditDocument(chatInput);

    // Ensure images and original blocks are strictly preserved
    const updatedModel: DocumentModel = {
      ...result.model,
      images: (result.model.images && result.model.images.length > 0) ? result.model.images : currentModel.images,
      original: (result.model.original && result.model.original.length > 0) ? result.model.original : currentModel.original,
    };

    // Rebuild final document after edit
    const config = resolveConfig(data.selection);
    const final = buildFinalDocument({ model: updatedModel, config, selection: data.selection });
    const audit = auditFinalDocument(final, updatedModel);

    await supabase
      .from("documents")
      .update({
        status: "formatted",
        model: toJson(updatedModel),
        final_document: toJson(final),
        final_audit: toJson(audit),
      })
      .eq("id", row.id);

    return { ok: true as const, message: result.message, audit };
  });

/** Administrative Server Functions using service role to aggregate system state */
export const getAdminUsersListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { data: profiles } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false });
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
  const authUsers = authData?.users ?? [];

  const { data: docs } = await supabaseAdmin.from("documents").select("user_id, created_at, institution");

  const docCountMap: Record<string, number> = {};
  if (docs) {
    docs.forEach((d: any) => {
      if (d.user_id) docCountMap[d.user_id] = (docCountMap[d.user_id] || 0) + 1;
    });
  }

  const userMap: Record<string, any> = {};

  // Ground truth: map auth.users
  authUsers.forEach((au) => {
    const email = au.email ?? "";
    const lower = email.toLowerCase();
    const isAdminEmail = lower === "philss7872@gmail.com" || lower === "phils7872@gmail.com";
    const meta = au.user_metadata || {};
    const name = meta.full_name || meta.name || (isAdminEmail ? "Phil (Platform Administrator)" : `Scholar (${au.id.substring(0, 6)})`);

    userMap[au.id] = {
      id: au.id,
      email,
      name,
      role: isAdminEmail ? "System Admin" : "Registered User",
      institution: "University of Bamenda",
      docCount: docCountMap[au.id] || 0,
      createdAt: au.created_at || new Date().toISOString(),
      status: isAdminEmail ? "admin" : au.email_confirmed_at ? "verified" : "active",
    };
  });

  // Aggregate/merge profiles table
  if (profiles) {
    profiles.forEach((p: any) => {
      const lower = (p.email || "").toLowerCase();
      const isAdminRole = p.role === "admin" || lower === "philss7872@gmail.com" || lower === "phils7872@gmail.com";
      const existing = userMap[p.id] || {};

      userMap[p.id] = {
        ...existing,
        id: p.id,
        email: p.email || existing.email || "",
        name: p.full_name || existing.name || (isAdminRole ? "Phil (Platform Administrator)" : `Scholar (${p.id.substring(0, 6)})`),
        role: isAdminRole ? "System Admin" : "Registered User",
        institution: p.institution || existing.institution || "University of Bamenda",
        docCount: docCountMap[p.id] || existing.docCount || 0,
        createdAt: p.created_at || existing.createdAt || new Date().toISOString(),
        status: isAdminRole ? "admin" : existing.status || "active",
      };
    });
  }

  return Object.values(userMap);
});

export const getAdminDocumentsListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { data: docs, error } = await supabaseAdmin
    .from("documents")
    .select("id, user_id, file_name, file_type, status, created_at, institution, storage_path")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return docs ?? [];
});

export const deleteDocumentAdminFn = createServerFn({ method: "POST" })
  .validator((data: { documentId: string; storagePath?: string }) => data)
  .handler(async ({ data }) => {
    if (data.storagePath) {
      await supabaseAdmin.storage.from("documents").remove([data.storagePath]);
    }
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getAdminReviewsListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { data: reviews, error } = await supabaseAdmin
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return reviews ?? [];
});

export const updateReviewAdminFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      updates: Partial<{ status: string; is_featured: boolean; rating: number; comment: string; recommendation: string }>;
    }) => data
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("reviews").update(data.updates).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteReviewAdminFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });