/**
 * AcadFormat Verification Audit Engine
 *
 * Runs 7 mandatory compliance checks against the reconstructed document AST
 * and generates an admin telemetry alert payload when any check fails.
 */

import type { FinalDocument, DocumentModel } from "./document-model";

export type CheckResult = "PASSED" | "FAILED";
export type AlertSeverity = "CRITICAL" | "WARNING" | "NONE";
export type ReconstructionStatus = "SUCCESS" | "AUTO_REMEDIATED" | "FAILED";

export interface AuditChecks {
  contentIntegrity: CheckResult;
  tableStructure: CheckResult;
  listFormatting: CheckResult;
  singleReferencesSection: CheckResult;
  paginationAndFlow: CheckResult;
  tocAccuracy: CheckResult;
  abbreviationCleanliness: CheckResult;
}

export interface PersistentError {
  category: string;
  description: string;
  recommendedAction: string;
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
  checks: AuditChecks;
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

/**
 * CHECK 1 — Content Integrity
 * word_count(final) >= 99% of word_count(originalText)
 */
function checkContentIntegrity(
  final: FinalDocument,
  originalText: string,
): { result: CheckResult; error?: PersistentError } {
  const originalWords = originalText.trim().split(/\s+/).filter(Boolean).length;
  const finalWords = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "para" || b.type === "heading1" || b.type === "heading2" || b.type === "listline" || b.type === "reference")
    .map((b) => b.text || "")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const ratio = originalWords > 0 ? finalWords / originalWords : 1;
  if (ratio >= 0.99) return { result: "PASSED" };
  return {
    result: "FAILED",
    error: {
      category: "CONTENT_INTEGRITY",
      description: `Word count dropped to ${Math.round(ratio * 100)}% of original (${originalWords} → ${finalWords} words). Minimum required: 99%.`,
      recommendedAction: "Re-analyse the document. Check AI prompt verbatim preservation rules and verbatim.ts restoration.",
    },
  };
}

/**
 * CHECK 2 — Table Structure
 * All table blocks must be unified table elements (not split into loose paragraphs).
 */
function checkTableStructure(
  final: FinalDocument,
  model: DocumentModel,
): { result: CheckResult; error?: PersistentError } {
  const finalTableCount = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "table").length;

  const modelTableCount = (model.chapters || []).reduce(
    (sum, ch) => sum + (ch.tables?.length ?? 0),
    0,
  );

  if (modelTableCount === 0) return { result: "PASSED" };
  if (finalTableCount >= modelTableCount) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      category: "TABLE_STRUCTURE",
      description: `Expected ${modelTableCount} table(s) but final document contains ${finalTableCount}. Tables may have been split into loose paragraphs.`,
      recommendedAction: "Review parseSectionContent table detection. Ensure flushTable() is called correctly and rows are not converted to paragraphs.",
    },
  };
}

/**
 * CHECK 3 — List Formatting
 * Checks that the final document contains listline/bullet blocks (i.e., lists were extracted).
 * Only flags if the model's section content has obvious list patterns that went undetected.
 */
function checkListFormatting(
  final: FinalDocument,
  model: DocumentModel,
): { result: CheckResult; error?: PersistentError } {
  const listPattern = /(?:RQ\s*\d+|^\s*\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)|^\s*\d+\.\s)/im;
  const hasListsInSource = (model.chapters || []).some((ch) =>
    ch.sections.some((s) => listPattern.test(s.content || ""))
  );

  if (!hasListsInSource) return { result: "PASSED" };

  const finalListCount = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "listline" || b.type === "bullet").length;

  if (finalListCount > 0) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      category: "LIST_FORMATTING",
      description: "Source content contains RQs, objectives, or Roman numeral lists but no list blocks were generated in the final document.",
      recommendedAction: "Check NUMBERED_ITEM_REGEX and BULLET_ITEM_REGEX in document-build.ts. Verify the inline run-in splitter is splitting RQ1/RQ2/(i)/(ii) patterns.",
    },
  };
}

/**
 * CHECK 4 — Single References Section
 * The final document must have exactly ONE heading1 block with text "REFERENCES".
 */
function checkSingleReferencesSection(
  final: FinalDocument,
): { result: CheckResult; error?: PersistentError } {
  const refHeadings = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "heading1" && /^references?$/i.test((b.text || "").trim()));

  if (refHeadings.length === 1) return { result: "PASSED" };
  if (refHeadings.length === 0) return { result: "PASSED" }; // No references in this doc

  return {
    result: "FAILED",
    error: {
      category: "REFERENCES_DUPLICATION",
      description: `Found ${refHeadings.length} References headings in the final document. Should be exactly 1.`,
      recommendedAction: "Ensure references are stripped from chapter content by the AI prompt rule. Check that document-build.ts only emits one References section.",
    },
  };
}

/**
 * CHECK 5 — Pagination & Flow
 * No chapter heading1 should appear as the only block on a page (orphaned heading).
 */
function checkPaginationAndFlow(
  final: FinalDocument,
): { result: CheckResult; error?: PersistentError } {
  const orphanedPages = final.pages.filter(
    (p) =>
      p.blocks.length === 1 &&
      (p.blocks[0]!.type === "heading1" || p.blocks[0]!.type === "heading2")
  );

  if (orphanedPages.length === 0) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      category: "PAGINATION_FLOW",
      description: `${orphanedPages.length} page(s) contain only an orphaned heading with no body text. This creates blank voids.`,
      recommendedAction: "Check chunkBlocks() in document-build.ts. Headings should always be grouped with subsequent content via keepWithNext logic.",
    },
  };
}

/**
 * CHECK 6 — TOC Accuracy
 * The TOC must reference at least as many sections as there are chapters.
 */
function checkTocAccuracy(
  final: FinalDocument,
  model: DocumentModel,
): { result: CheckResult; error?: PersistentError } {
  // Find the TOC page
  const tocPage = final.pages.find((p) => p.sectionTitle === "Table of Contents");
  if (!tocPage) return { result: "PASSED" }; // TOC not generated — nothing to validate

  const tocEntries = tocPage.blocks.filter((b) => b.type === "listline").length;
  const expectedMin = model.chapters?.length ?? 0;

  if (tocEntries >= expectedMin) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      category: "TOC_ACCURACY",
      description: `TOC has ${tocEntries} entries but document has ${expectedMin} chapter(s). TOC may be missing sections.`,
      recommendedAction: "Review TOC generation in document-build.ts. Ensure all chapter and section headings are registered in the toc[] array.",
    },
  };
}

/**
 * CHECK 7 — Abbreviation Cleanliness
 * No block text should contain noise placeholders.
 */
function checkAbbreviationCleanliness(
  final: FinalDocument,
  model: DocumentModel,
): { result: CheckResult; error?: PersistentError } {
  // Check abbreviations list
  const dirtyAbbrev = (model.abbreviations || []).some(
    (a) => hasNoise(a.abbreviation) || hasNoise(a.meaning)
  );

  // Check if any rendered block contains noise
  const dirtyBlock = final.pages
    .flatMap((p) => p.blocks)
    .some((b) => hasNoise(b.text || ""));

  if (!dirtyAbbrev && !dirtyBlock) return { result: "PASSED" };

  return {
    result: "FAILED",
    error: {
      category: "ABBREVIATION_NOISE",
      description: "Placeholder strings (REQUIRES_USER_REVIEW, undefined, null) or AI artifacts (→, =>) detected in document output.",
      recommendedAction: "Check normalize() in ai.server.ts to strip REQUIRES_USER_REVIEW. Check parseSectionContent noise stripping in document-build.ts.",
    },
  };
}

/**
 * Run all 7 mandatory verification checks and produce an AuditResult.
 */
export function runVerificationAudit(input: {
  documentId: string;
  userId: string;
  final: FinalDocument;
  model: DocumentModel;
  originalText: string;
}): AuditResult {
  const { documentId, userId, final, model, originalText } = input;

  const results = {
    contentIntegrity: checkContentIntegrity(final, originalText),
    tableStructure: checkTableStructure(final, model),
    listFormatting: checkListFormatting(final, model),
    singleReferencesSection: checkSingleReferencesSection(final),
    paginationAndFlow: checkPaginationAndFlow(final),
    tocAccuracy: checkTocAccuracy(final, model),
    abbreviationCleanliness: checkAbbreviationCleanliness(final, model),
  };

  const checks: AuditChecks = {
    contentIntegrity: results.contentIntegrity.result,
    tableStructure: results.tableStructure.result,
    listFormatting: results.listFormatting.result,
    singleReferencesSection: results.singleReferencesSection.result,
    paginationAndFlow: results.paginationAndFlow.result,
    tocAccuracy: results.tocAccuracy.result,
    abbreviationCleanliness: results.abbreviationCleanliness.result,
  };

  const persistentErrors: PersistentError[] = Object.values(results)
    .filter((r) => r.result === "FAILED" && r.error)
    .map((r) => r.error!);

  const verificationPassed = persistentErrors.length === 0;
  const alertTriggered = !verificationPassed;

  // Determine severity: CRITICAL if content integrity or table structure fails, WARNING otherwise
  let severity: AlertSeverity = "NONE";
  if (alertTriggered) {
    const criticalFailed =
      checks.contentIntegrity === "FAILED" || checks.tableStructure === "FAILED";
    severity = criticalFailed ? "CRITICAL" : "WARNING";
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
      checks,
    },
    adminAlert: {
      alertTriggered,
      severity,
      userId,
      documentId,
      timestamp: new Date().toISOString(),
      persistentErrors,
    },
    downloadReady: checks.contentIntegrity === "PASSED",
  };
}
