import type { PreservationSnapshot } from "./preservation";
import type { FinalDocument, DocumentModel } from "./document-model";

export interface IntegrityReport {
  /** true = document passed integrity checks and can be delivered */
  pass: boolean;

  originalParagraphs: number;
  finalParagraphs: number;
  paragraphsOk: boolean;

  originalWords: number;
  finalWords: number;
  wordsOk: boolean;

  originalTables: number;
  finalTables: number;
  tablesOk: boolean;

  originalHeadings: number;
  finalHeadings: number;
  headingsOk: boolean;

  /** Human-readable warnings (non-fatal). */
  warnings: string[];
  /** Human-readable errors that caused FAIL. */
  errors: string[];
}

/**
 * Compare the original preservation snapshot against the rendered final document
 * and the (possibly modified) DocumentModel.
 *
 * Thresholds (conservative — flag on significant loss, not minor rounding):
 *   - Words: fail if final has <75% of original
 *   - Tables: fail if final has fewer tables than original (phantom tables are a warning)
 *   - Headings: warn if final has <80% of original
 *   - Paragraphs: warn if final has <70% of original
 */
export function validateIntegrity(
  snapshot: PreservationSnapshot,
  final: FinalDocument,
  model: DocumentModel,
): IntegrityReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  // ── Words ──────────────────────────────────────────────────────────────────
  // Count ALL text-bearing block types — not just para/heading.
  // Excluding listline, reference, bullet, center, caption, code caused
  // severe false-positive "content loss" errors even when content was intact.
  const NON_TEXT_TYPES = new Set(["image", "logos", "spacer", "table", "bilingual", "ubaHeader"]);
  const finalText = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => !NON_TEXT_TYPES.has(b.type) && b.text)
    .map((b) => b.text)
    .join(" ");

  const finalWords = finalText.trim().split(/\s+/).filter(Boolean).length;
  const wordRatio = snapshot.wordCount > 0 ? finalWords / snapshot.wordCount : 1;
  const wordsOk = wordRatio >= 0.75;
  if (!wordsOk) {
    errors.push(
      `Word count dropped from ${snapshot.wordCount} → ${finalWords} ` +
      `(${Math.round(wordRatio * 100)}% of original). ` +
      `Minimum acceptable is 75%. Document may have lost content.`,
    );
  } else if (wordRatio < 0.90) {
    warnings.push(
      `Word count is ${Math.round(wordRatio * 100)}% of original (${snapshot.wordCount} → ${finalWords}). ` +
      `Minor content may have been trimmed.`,
    );
  }

  // ── Tables ─────────────────────────────────────────────────────────────
  const finalTables = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "table").length;

  const tablesOk = finalTables >= snapshot.tableCount;
  if (!tablesOk && snapshot.tableCount > 0) {
    errors.push(
      `Table count dropped from ${snapshot.tableCount} → ${finalTables}. ` +
      `Original tables must be preserved.`,
    );
  }
  if (finalTables > snapshot.tableCount && snapshot.tableCount === 0) {
    warnings.push(
      `${finalTables} table(s) were generated but the original document had no tables. ` +
      `Check for phantom table generation.`,
    );
  }

  // ── Headings ───────────────────────────────────────────────────────────
  const finalHeadings = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "heading1" || b.type === "heading2").length;

  const headingRatio = snapshot.headingCount > 0 ? finalHeadings / snapshot.headingCount : 1;
  const headingsOk = headingRatio >= 0.80;
  if (!headingsOk && snapshot.headingCount > 0) {
    warnings.push(
      `Heading count dropped from ${snapshot.headingCount} → ${finalHeadings} ` +
      `(${Math.round(headingRatio * 100)}% of original).`,
    );
  }

  // ── Paragraphs ─────────────────────────────────────────────────────────
  const finalParagraphs = final.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "para").length;

  const paraRatio = snapshot.paragraphCount > 0 ? finalParagraphs / snapshot.paragraphCount : 1;
  const paragraphsOk = paraRatio >= 0.70;
  if (!paragraphsOk && snapshot.paragraphCount > 0) {
    warnings.push(
      `Paragraph count dropped from ${snapshot.paragraphCount} → ${finalParagraphs} ` +
      `(${Math.round(paraRatio * 100)}% of original).`,
    );
  }

  const pass = wordsOk && tablesOk;

  return {
    pass,
    originalParagraphs: snapshot.paragraphCount,
    finalParagraphs,
    paragraphsOk,
    originalWords: snapshot.wordCount,
    finalWords,
    wordsOk,
    originalTables: snapshot.tableCount,
    finalTables,
    tablesOk,
    originalHeadings: snapshot.headingCount,
    finalHeadings,
    headingsOk,
    warnings,
    errors,
  };
}

/**
 * Validate the AI-edited DocumentModel against the original model to
 * detect silent chapter erasure by the chat edit AI.
 *
 * Returns a list of chapters whose word count dropped by more than 30%.
 */
export function detectChatEditErasure(
  originalModel: DocumentModel,
  editedModel: DocumentModel,
): { chapter: number; title: string; originalWords: number; editedWords: number }[] {
  const issues: { chapter: number; title: string; originalWords: number; editedWords: number }[] = [];

  originalModel.chapters.forEach((origChap, idx) => {
    const editedChap = editedModel.chapters[idx];
    if (!editedChap) {
      issues.push({ chapter: idx + 1, title: origChap.title, originalWords: wordCount(origChap), editedWords: 0 });
      return;
    }
    const origWords = wordCount(origChap);
    const editedWords = wordCount(editedChap);
    if (origWords > 100 && editedWords < origWords * 0.70) {
      issues.push({ chapter: idx + 1, title: origChap.title, originalWords: origWords, editedWords });
    }
  });

  return issues;
}

function wordCount(chapter: any): number {
  const texts: string[] = [];
  if (chapter.intro) texts.push(chapter.intro);
  for (const sec of chapter.sections || []) {
    if (sec.content) texts.push(sec.content);
  }
  return texts.join(" ").trim().split(/\s+/).filter(Boolean).length;
}
