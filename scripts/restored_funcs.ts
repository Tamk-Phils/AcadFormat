function chunkBlocks(blocks: Block[]): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let used = 0;
  // Standard A4/Letter page height = 792pt. Margins top=72pt, bottom=72pt.
  // Printable content height per page = 648pt.
  const PAGE_BUDGET = 648;

  for (const block of blocks) {
    let weight = 0;
    const textLen = (block.text || "").length;

    if (block.type === "heading1") {
      const lines = Math.ceil(Math.max(1, textLen) / 45);
      weight = lines * 24 + 16;
    } else if (block.type === "heading2") {
      const lines = Math.ceil(Math.max(1, textLen) / 55);
      weight = lines * 20 + 12;
    } else if (block.type === "image") {
      weight = block.imageId?.includes("logo") ? 82 : 220;
    } else if (block.type === "logos") {
      weight = 82;
    } else if (block.type === "title") {
      const lines = Math.ceil(Math.max(1, textLen) / 45);
      weight = lines * 24 + 30;
    } else if (block.type === "table") {
      const rows = parseTableRows(block);
      const rCount = Math.max(1, rows.length);
      weight = rCount * 20 + 24;
    } else if (block.type === "code") {
      const lCount = Math.max(1, (block.text || "").split("\n").length);
      weight = lCount * 13 + 18;
    } else if (block.type === "bilingual" || block.type === "ubaHeader") {
      weight = 110;
    } else if (block.type === "spacer") {
      weight = 18;
    } else if (block.type === "caption") {
      const lines = Math.ceil(Math.max(1, textLen) / 65);
      weight = lines * 15 + 6;
    } else {
      // Paragraph, center, listline
      const lines = Math.ceil(Math.max(1, textLen) / 72);
      weight = lines * 18 + 6;
    }

    if (used + weight > PAGE_BUDGET && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += weight;
  }
  if (current.length > 0) pages.push(current);

  // Pass 1 & 2: Never leave a heading or table caption orphaned as the LAST block on a page,
  // and never allow a page to consist ONLY of headings/captions without body content.
  let cleanedPages: Block[][] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (page.length === 0) continue;

    // If this page is not the last page, check for trailing headings
    if (i < pages.length - 1) {
      const next = pages[i + 1]!;
      // While page ends with a heading or caption, push it to top of next page
      while (
        page.length > 0 &&
        (page[page.length - 1]!.type === "heading1" ||
          page[page.length - 1]!.type === "heading2" ||
          page[page.length - 1]!.type === "caption")
      ) {
        next.unshift(page.pop()!);
      }
    }

    if (page.length > 0) {
      cleanedPages.push(page);
    }
  }
  return cleanedPages.length > 0 ? cleanedPages : [[]];
}

function getTOCLevel(text: string): number {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)*)\b/);
  if (match && match[1]) {
    const dots = (match[1].match(/\./g) || []).length;
    return Math.min(3, dots + 1);
  }
  return 2;
}

export interface BuildInput {
  model: DocumentModel;
  config: InstitutionConfig;
  selection: InstitutionSelection;
}

function wrapTextToLines(text: string, maxLen: number = 20): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length > maxLen) {
      lines.push(current);
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Builds the single final document model that drives preview, DOCX and PDF.
 * Body pages are laid out first so that the Table of Contents, List of Figures
 * and List of Tables carry page numbers taken from the real rendered document.
 */
export function buildFinalDocument(input: any): FinalDocument {
