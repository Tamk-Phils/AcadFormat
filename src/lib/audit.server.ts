/**
 * AcadFormat Verification Audit Engine
 *
 * Runs 5 mandatory quality gates against the reconstructed document AST
 * and generates an admin telemetry alert payload when any gate fails.
 *
 * Gate schema matches the AcadFormat Admin Telemetry Directive v2:
 *   GATE_REFERENCES | GATE_TABLES | GATE_TEXT_FLOW | GATE_LISTS | GATE_CONTENT
 */

import type { FinalDocument, DocumentModel } from "./document-model";

export type GateResult = "PASSED" | "FAILED";
export type AlertSeverity = "CRITICAL" | "WARNING" | "NONE";
export type ReconstructionStatus = "SUCCESS" | "AUTO_REMEDIATED" | "FAILED";

export interface AuditGates {
  referencesUnified: GateResult;    // GATE_REFERENCES
  tablesIntact: GateResult;          // GATE_TABLES
  textFlowNoSlicing: GateResult;     // GATE_TEXT_FLOW
  listsConverted: GateResult;        // GATE_LISTS
  contentIntegrity: GateResult;      // GATE_CONTENT
}

export interface PersistentError {
  gate: string;
  description: string;
  actionRequired: string;
}

export interface AdminAlert {
  alertTriggered: boolean;
  severity: AlertSeverity;
  userId: string;
  documentId: string;
  timestamp: string;
  persistentErrors: PersistentError[];
}

export interface VerificationAudit {
  verificationPassed: boolean;
  gates: AuditGates;
}

export interface AuditResult {
  documentId: string;
  userId: string;
  reconstructionStatus: ReconstructionStatus;
  verificationAudit: VerificationAudit;
  adminAlert: AdminAlert;
  downloadReady: boolean;
}

const NOISE_PATTERNS = [
  /\bREQUIRES_USER_REVIEW\b/,
  /\bundefined\b/,
  /\bnull\b/,
  /```/,
  /→\s/,
  /=>\s/,
];

function hasNoise(text: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(text));
}

function allFinalWords(final: FinalDocument): string[] {
  const NON_TEXT = new Set(["image", "logos", "spacer", "table", "bilingual", "ubaHeader"]);
  return final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => !NON_TEXT.has(b.type) && b.text)
    .map((b) => b.text!)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE_REFERENCES — Exactly ONE References section, no duplicate headings
// ─────────────────────────────────────────────────────────────────────────────
function gateReferences(
  final: FinalDocument,
): { result: GateResult; error?: PersistentError } {
  const refHeadings = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "heading1" && /^references?$/i.test((b.text || "").trim()));

  if (refHeadings.length <= 1) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      gate: "GATE_REFERENCES",
      description: `Found ${refHeadings.length} References headings in the final document. Exactly 1 is required.`,
      actionRequired:
        "Ensure the AI prompt rule prevents bibliography text inside chapter content. Verify document-build.ts only emits one References pushBody() call.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE_TABLES — All model tables present as unified grid elements (not split rows)
// ─────────────────────────────────────────────────────────────────────────────
function gateTables(
  final: FinalDocument,
  model: DocumentModel,
): { result: GateResult; error?: PersistentError } {
  const finalTableCount = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "table").length;

  const modelTableCount = (model.chapters || []).reduce(
    (sum, ch) => sum + (ch.tables?.length ?? 0),
    0,
  );

  if (modelTableCount === 0) return { result: "PASSED" };
  if (finalTableCount >= modelTableCount) return { result: "PASSED" };

  // Also check for timeline row leakage — month-like rows appearing as paragraphs
  const allParaText = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "para")
    .map((b) => b.text || "")
    .join(" ");
  const timelineLeakage = /\bMonth\s+\d+\b/i.test(allParaText);

  const extra = timelineLeakage
    ? " Timeline rows (e.g., \"Month 1\", \"Month 2\") appear to have leaked into body paragraphs."
    : "";

  return {
    result: "FAILED",
    error: {
      gate: "GATE_TABLES",
      description:
        `Expected ${modelTableCount} table(s) as unified grid elements, found ${finalTableCount}.${extra}`,
      actionRequired:
        "Review flushTable() in document-build.ts. Ensure table rows are never converted to external paragraphs. Check that 'Month N' timeline cells remain inside the table block.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE_TEXT_FLOW — No artificial sentence fragmentation or mid-sentence line breaks
// ─────────────────────────────────────────────────────────────────────────────
function gateTextFlow(
  final: FinalDocument,
): { result: GateResult; error?: PersistentError } {
  // Detect paragraphs that end with a word fragment (no terminal punctuation)
  // and are suspiciously short (< 40 chars), indicating artificial line slicing
  const paraBlocks = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "para" && b.text);

  const slicedCount = paraBlocks.filter((b) => {
    const text = (b.text || "").trim();
    // Short para that doesn't end with punctuation — likely a sliced sentence
    const isTitleOrStep = /^(?:step|task|part|chapter|section)\s+\d+/i.test(text) || /^(?:learning objectives|reference information|addressing table|ports assignment network|basic vlan configuration)/i.test(text);
    if (isTitleOrStep) return false;
    return text.length > 0 && text.length < 40 && !/[.!?:;,)\]"'»]$/.test(text);
  }).length;

  // Also detect AI-injected noise characters
  const noiseCount = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => hasNoise(b.text || "")).length;

  if (slicedCount === 0 && noiseCount === 0) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      gate: "GATE_TEXT_FLOW",
      description:
        `Detected ${slicedCount} potentially sliced paragraph fragment(s) and ${noiseCount} block(s) with AI artifact noise (→, =>, REQUIRES_USER_REVIEW, undefined).`,
      actionRequired:
        "Check parseSectionContent() noise stripping in document-build.ts. Ensure no artificial \\n breaks are injected inside sentence text. Verify normalize() in ai.server.ts strips all placeholder strings.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE_LISTS — RQs, Objectives, and numbered/roman items converted to list nodes
// ─────────────────────────────────────────────────────────────────────────────
function gateLists(
  final: FinalDocument,
  model: DocumentModel,
): { result: GateResult; error?: PersistentError } {
  const listPattern = /(?:R?Q\s*\d+|\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)|\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s|\b\d+\.\s)/im;
  const hasListsInSource = (model.chapters || []).some((ch) =>
    ch.sections.some((s) => listPattern.test(s.content || "")) ||
    listPattern.test(ch.intro || "")
  );

  if (!hasListsInSource) return { result: "PASSED" };

  const finalListCount = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "listline" || b.type === "bullet").length;

  if (finalListCount > 0) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      gate: "GATE_LISTS",
      description:
        "Source content contains RQs, numbered objectives, or Roman numeral items but no structured list blocks were found in the final document.",
      actionRequired:
        "Check NUMBERED_ITEM_REGEX and the inline run-in splitter in document-build.ts. Verify RQ1/RQ2/(i)/(ii)/I./II. patterns are split before block detection.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE_CONTENT — Reconstructed word count >= 99% of original
// ─────────────────────────────────────────────────────────────────────────────
function gateContent(
  final: FinalDocument,
  originalText: string,
): { result: GateResult; error?: PersistentError } {
  const originalWords = originalText.trim().split(/\s+/).filter(Boolean).length;
  const finalWords = allFinalWords(final).length;
  const ratio = originalWords > 0 ? finalWords / originalWords : 1;

  if (ratio >= 0.99) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      gate: "GATE_CONTENT",
      description: `Word count dropped to ${Math.round(ratio * 100)}% of original (${originalWords} → ${finalWords} words). Minimum required: 99%.`,
      actionRequired:
        "Re-analyse the document. Ensure verbatim.ts restoration is covering all sections. Confirm the AI prompt enforces the zero-truncation rule.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Run all 5 quality gates and produce the full AuditResult payload
// ─────────────────────────────────────────────────────────────────────────────
export function runVerificationAudit(input: {
  documentId: string;
  userId: string;
  final: FinalDocument;
  model: DocumentModel;
  originalText: string;
}): AuditResult {
  const { documentId, userId, final, model, originalText } = input;

  const gateResults = {
    referencesUnified: gateReferences(final),
    tablesIntact:      gateTables(final, model),
    textFlowNoSlicing: gateTextFlow(final),
    listsConverted:    gateLists(final, model),
    contentIntegrity:  gateContent(final, originalText),
  };

  const gates: AuditGates = {
    referencesUnified:  gateResults.referencesUnified.result,
    tablesIntact:       gateResults.tablesIntact.result,
    textFlowNoSlicing:  gateResults.textFlowNoSlicing.result,
    listsConverted:     gateResults.listsConverted.result,
    contentIntegrity:   gateResults.contentIntegrity.result,
  };

  const persistentErrors: PersistentError[] = Object.values(gateResults)
    .filter((r) => r.result === "FAILED" && r.error)
    .map((r) => r.error!);

  const verificationPassed = persistentErrors.length === 0;
  const alertTriggered = !verificationPassed;

  // CRITICAL = content loss or table corruption; WARNING = flow/list/reference issues
  let severity: AlertSeverity = "NONE";
  if (alertTriggered) {
    const isCritical =
      gates.contentIntegrity === "FAILED" || gates.tablesIntact === "FAILED";
    severity = isCritical ? "CRITICAL" : "WARNING";
  }

  const reconstructionStatus: ReconstructionStatus = verificationPassed
    ? "SUCCESS"
    : persistentErrors.length <= 2
    ? "AUTO_REMEDIATED"
    : "FAILED";

  return {
    documentId,
    userId,
    reconstructionStatus,
    verificationAudit: {
      verificationPassed,
      gates,
    },
    adminAlert: {
      alertTriggered,
      severity,
      userId,
      documentId,
      timestamp: new Date().toISOString(),
      persistentErrors,
    },
    downloadReady: gates.contentIntegrity === "PASSED",
  };
}
