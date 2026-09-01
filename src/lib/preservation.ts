import type { OriginalBlock } from "./document-model";

/**
 * Immutable snapshot of the uploaded document captured immediately after extraction,
 * before any AI analysis or formatting occurs. Used by the Integrity Validator to
 * detect accidental content loss during the pipeline.
 */
export interface PreservationSnapshot {
  /** Number of paragraph-level blocks in the original document. */
  paragraphCount: number;
  /** Approximate word count of the original document text. */
  wordCount: number;
  /** Number of real tables detected in the original document. */
  tableCount: number;
  /** Number of heading-level blocks in the original document. */
  headingCount: number;
  /** Number of images / figures in the original document. */
  imageCount: number;
  /** Total character length of the source text. */
  charCount: number;
  /** The first 200 chars of the source text, used as a fingerprint. */
  fingerprint: string;
}

/**
 * Create a preservation snapshot from the extracted document.
 * Call this immediately after `extractDocument()`, before anything else.
 */
export function preserveDocument(
  sourceText: string,
  originalBlocks: OriginalBlock[],
  tableCount: number,
  imageCount: number,
): PreservationSnapshot {
  const paragraphCount = originalBlocks.filter((b) => b.type === "para").length;
  const headingCount = originalBlocks.filter((b) => b.type === "heading").length;
  const words = sourceText.trim().split(/\s+/).filter(Boolean);

  return {
    paragraphCount,
    wordCount: words.length,
    tableCount,
    imageCount,
    headingCount,
    charCount: sourceText.length,
    fingerprint: sourceText.slice(0, 200),
  };
}
