import type {
  Block,
  DocumentModel,
  FinalDocument,
  ListEntry,
  RenderedPage,
} from "./document-model";
import type { InstitutionConfig, InstitutionSelection, SectionType } from "./institutions";
import { workLabel } from "./institutions";

/** Approximate characters that fit on one A4/Letter page at 12pt, 1.5 spacing. */
const CHARS_PER_PAGE = 2900;

const PRELIM_TITLES: Partial<Record<SectionType, string>> = {
  COVER_PAGE: "Cover Page",
  TITLE_PAGE: "Title Page",
  COPYRIGHT: "Copyright",
  DECLARATION: "Declaration of Originality of Study",
  CERTIFICATION: "Certification",
  ACCEPTANCE: "Acceptance of Dissertation",
  ABSTRACT: "Abstract",
  RESUME: "Résumé",
  DEDICATION: "Dedication",
  ACKNOWLEDGEMENTS: "Acknowledgements",
  TABLE_OF_CONTENTS: "Table of Contents",
  LIST_OF_TABLES: "List of Tables",
  LIST_OF_FIGURES: "List of Figures",
  LIST_OF_ABBREVIATIONS: "List of Abbreviations",
};

function roman(n: number): string {
  const map: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  let rest = n;
  for (const [value, sym] of map) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

const CHAPTER_PREFIX =
  /^\s*chapter\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b[:.\-–—]?\s*/i;
const NUMBER_PREFIX = /^\s*\d+(?:\.\d+)*[.)]?\s+/;

/**
 * Removes numbering the author already typed ("1.1 Background", "CHAPTER TWO:")
 * so the rebuilt document never shows a duplicated label such as "1.1 1.1".
 */
export function cleanTitle(raw: string): string {
  let title = (raw || "").trim();
  let previous = "";
  while (title !== previous) {
    previous = title;
    title = title.replace(CHAPTER_PREFIX, "").replace(NUMBER_PREFIX, "").trim();
  }
  return title || (raw || "").trim();
}

/** A short line that is only a chapter/section heading repeated inside body text. */
function isStrayHeading(line: string): boolean {
  const text = line.trim();
  if (text.length > 80) return false;
  if (CHAPTER_PREFIX.test(text)) return true;
  return /^\d+(\.\d+)*[.)]?\s+[A-Z][^.]{0,60}$/.test(text) && !/[.!?]$/.test(text);
}

function paragraphs(text: string): string[] {
  return (text || "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !isStrayHeading(p));
}

/** Split blocks into page-sized chunks using an approximate character budget. */
function chunkBlocks(blocks: Block[]): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let used = 0;
  for (const block of blocks) {
    const weight =
      block.type === "heading1"
        ? 420
        : block.type === "heading2"
          ? 220
          : block.type === "image"
            ? 900
            : block.type === "logos"
              ? 300
              : block.text.length + 60;
    if (used + weight > CHARS_PER_PAGE && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += weight;
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

export interface BuildInput {
  model: DocumentModel;
  config: InstitutionConfig;
  selection: InstitutionSelection;
}

/**
 * Builds the single final document model that drives preview, DOCX and PDF.
 * Body pages are laid out first so that the Table of Contents, List of Figures
 * and List of Tables carry page numbers taken from the real rendered document.
 */
export function buildFinalDocument({ model, config, selection }: BuildInput): FinalDocument {
  const toc: (ListEntry & { level: number })[] = [];
  const listOfFigures: ListEntry[] = [];
  const listOfTables: ListEntry[] = [];
  const bodyPages: RenderedPage[] = [];

  const pushBody = (sectionTitle: string, blocks: Block[], kind: "body" | "back") => {
    const startNumber = bodyPages.length + 1;
    chunkBlocks(blocks).forEach((pageBlocks, i) => {
      bodyPages.push({
        index: 0,
        numberLabel: String(startNumber + i),
        kind,
        sectionTitle,
        startsSection: i === 0,
        blocks: pageBlocks,
      });
    });
    return startNumber;
  };

  const figureImages = (model.images ?? []).filter((image) => image.role === "figure");
  const logoImages = (model.images ?? []).filter((image) => image.role === "logo");
  let figureImageCursor = 0;

  // ---- Chapters (figures and tables renumbered per the institutional rule) ----
  model.chapters.forEach((chapter, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    const blocks: Block[] = [
      { type: "heading1", text: `CHAPTER ${chapterNumber}: ${chapter.title.toUpperCase()}` },
    ];
    paragraphs(chapter.intro || "").forEach((p) => blocks.push({ type: "para", text: p }));

    const sectionPageMarks: { title: string; blockIndex: number }[] = [];
    chapter.sections.forEach((section, sectionIndex) => {
      const number = `${chapterNumber}.${sectionIndex + 1}`;
      sectionPageMarks.push({ title: `${number} ${section.title}`, blockIndex: blocks.length });
      blocks.push({ type: "heading2", text: `${number} ${section.title}` });
      paragraphs(section.content).forEach((p) => blocks.push({ type: "para", text: p }));
    });

    const figureMarks: { label: string; caption: string; blockIndex: number }[] = [];
    chapter.figures.forEach((figure, figureIndex) => {
      const label =
        config.figureNumbering === "chapter"
          ? `Figure ${chapterNumber}.${figureIndex + 1}`
          : `Figure ${listOfFigures.length + figureIndex + 1}`;
      figureMarks.push({ label, caption: figure.caption, blockIndex: blocks.length });
      const image = figureImages[figureImageCursor];
      if (image) {
        figureImageCursor += 1;
        blocks.push({ type: "image", text: figure.caption, imageId: image.id });
      } else {
        blocks.push({ type: "center", text: `[ ${figure.originalLabel || figure.kind || "Figure"} ]` });
      }
      blocks.push({ type: "caption", text: `${label}: ${figure.caption}` });
    });

    const tableMarks: { label: string; title: string; blockIndex: number }[] = [];
    chapter.tables.forEach((table, tableIndex) => {
      const label =
        config.tableNumbering === "chapter"
          ? `Table ${chapterNumber}.${tableIndex + 1}`
          : `Table ${listOfTables.length + tableIndex + 1}`;
      tableMarks.push({ label, title: table.title, blockIndex: blocks.length });
      blocks.push({ type: "caption", text: `${label}: ${table.title}` });
      blocks.push({ type: "center", text: `[ ${table.originalLabel || "Table content"} ]` });
    });

    const startPage = pushBody(`Chapter ${chapterNumber}`, blocks, "body");
    const pageOfBlock = (blockIndex: number) => {
      // Recompute which chunk the block landed in.
      const chunks = chunkBlocks(blocks);
      let seen = 0;
      for (let i = 0; i < chunks.length; i += 1) {
        seen += chunks[i]!.length;
        if (blockIndex < seen) return String(startPage + i);
      }
      return String(startPage);
    };

    toc.push({
      label: `CHAPTER ${chapterNumber}`,
      text: chapter.title.toUpperCase(),
      page: String(startPage),
      level: 1,
    });
    sectionPageMarks.forEach((mark) =>
      toc.push({ label: "", text: mark.title, page: pageOfBlock(mark.blockIndex), level: 2 }),
    );
    figureMarks.forEach((mark) =>
      listOfFigures.push({
        label: mark.label,
        text: mark.caption,
        page: pageOfBlock(mark.blockIndex),
      }),
    );
    tableMarks.forEach((mark) =>
      listOfTables.push({ label: mark.label, text: mark.title, page: pageOfBlock(mark.blockIndex) }),
    );
  });

  // ---- References (never a chapter) ----
  if (model.references.length > 0) {
    const blocks: Block[] = [{ type: "heading1", text: "REFERENCES" }];
    [...model.references]
      .sort((a, b) => a.localeCompare(b))
      .forEach((reference) => blocks.push({ type: "listline", text: reference }));
    const page = pushBody("References", blocks, "back");
    toc.push({ label: "", text: "REFERENCES", page: String(page), level: 1 });
  }

  // ---- Appendices (never a chapter) ----
  if (model.appendices.length > 0) {
    const blocks: Block[] = [{ type: "heading1", text: "APPENDICES" }];
    model.appendices.forEach((appendix) => {
      blocks.push({ type: "heading2", text: `${appendix.label}: ${appendix.title}` });
      paragraphs(appendix.content).forEach((p) => blocks.push({ type: "para", text: p }));
    });
    const page = pushBody("Appendices", blocks, "back");
    toc.push({ label: "", text: "APPENDICES", page: String(page), level: 1 });
  }

  const listOfAbbreviations = model.abbreviations.map((a) => ({
    label: a.abbreviation,
    text: a.meaning,
  }));

  // ---- Preliminary pages (roman numerals, generated lists) ----
  const prelimPages: RenderedPage[] = [];
  const addPrelim = (sectionTitle: string, blocks: Block[], kind: "cover" | "preliminary") => {
    chunkBlocks(blocks).forEach((pageBlocks, i) => {
      prelimPages.push({
        index: 0,
        numberLabel: "",
        kind,
        sectionTitle,
        startsSection: i === 0,
        blocks: pageBlocks,
      });
    });
  };

  const meta = model.meta;
  const coverBlocks: Block[] = [
    ...(logoImages.length > 0
      ? [{ type: "logos" as const, text: "", imageIds: logoImages.map((image) => image.id) }]
      : []),
    { type: "center", text: "REPUBLIC OF CAMEROON" },
    { type: "center", text: "Peace – Work – Fatherland" },
    { type: "center", text: selection.university.toUpperCase() },
    { type: "center", text: selection.school.toUpperCase() },
    { type: "center", text: `DEPARTMENT OF ${(meta.department || selection.department).toUpperCase()}` },
    { type: "spacer", text: "" },
    { type: "title", text: meta.title.toUpperCase() },
    { type: "spacer", text: "" },
    {
      type: "center",
      text: `${workLabel(selection.documentType, selection.level)} submitted in partial fulfilment of the requirements for the award of ${selection.level}`,
    },
    { type: "spacer", text: "" },
    { type: "center", text: (meta.author || "AUTHOR NAME").toUpperCase() },
    { type: "center", text: `Registration Number: ${meta.registrationNumber || "—"}` },
    { type: "spacer", text: "" },
    { type: "center", text: "SUPERVISOR(S):" },
    ...(meta.supervisors?.length
      ? meta.supervisors.map((s) => ({ type: "center" as const, text: s }))
      : [{ type: "center" as const, text: "—" }]),
    { type: "spacer", text: "" },
    { type: "center", text: (meta.monthYear || "").toUpperCase() },
  ];

  for (const type of config.preliminaryOrder) {
    const title = PRELIM_TITLES[type] || type.replace(/_/g, " ");
    if (type === "COVER_PAGE") {
      addPrelim("Cover Page", coverBlocks, "cover");
      continue;
    }
    if (type === "TITLE_PAGE") {
      addPrelim("Title Page", coverBlocks, "preliminary");
      continue;
    }
    if (type === "TABLE_OF_CONTENTS") {
      addPrelim("Table of Contents", [
        { type: "heading1", text: "TABLE OF CONTENTS" },
        ...toc.map((entry) => ({
          type: "listline" as const,
          text: `${entry.level === 1 ? "" : "    "}${entry.label ? `${entry.label}: ` : ""}${entry.text}\t${entry.page}`,
        })),
      ], "preliminary");
      continue;
    }
    if (type === "LIST_OF_FIGURES") {
      addPrelim("List of Figures", [
        { type: "heading1", text: "LIST OF FIGURES" },
        ...(listOfFigures.length
          ? listOfFigures.map((entry) => ({
              type: "listline" as const,
              text: `${entry.label}: ${entry.text}\t${entry.page}`,
            }))
          : [{ type: "para" as const, text: "No figures detected in this document." }]),
      ], "preliminary");
      continue;
    }
    if (type === "LIST_OF_TABLES") {
      addPrelim("List of Tables", [
        { type: "heading1", text: "LIST OF TABLES" },
        ...(listOfTables.length
          ? listOfTables.map((entry) => ({
              type: "listline" as const,
              text: `${entry.label}: ${entry.text}\t${entry.page}`,
            }))
          : [{ type: "para" as const, text: "No tables detected in this document." }]),
      ], "preliminary");
      continue;
    }
    if (type === "LIST_OF_ABBREVIATIONS") {
      addPrelim("List of Abbreviations", [
        { type: "heading1", text: "LIST OF ABBREVIATIONS" },
        ...(listOfAbbreviations.length
          ? listOfAbbreviations.map((entry) => ({
              type: "listline" as const,
              text: `${entry.label}\t${entry.text}`,
            }))
          : [{ type: "para" as const, text: "No abbreviations detected in this document." }]),
      ], "preliminary");
      continue;
    }

    const existing = model.preliminary.find((p) => p.type === type);
    const content = existing?.content?.trim();
    addPrelim(title, [
      { type: "heading1", text: title.toUpperCase() },
      content
        ? { type: "para", text: content }
        : { type: "para", text: `[${title} — required by ${config.label}. REQUIRES_USER_REVIEW]` },
      ...(type === "ABSTRACT" && meta.keywords?.length
        ? [{ type: "para" as const, text: `Keywords: ${meta.keywords.slice(0, 6).join(", ")}` }]
        : []),
    ], "preliminary");
  }

  // Number pages: cover unnumbered unless required, prelims roman, body arabic.
  let romanCounter = 0;
  prelimPages.forEach((page) => {
    if (page.kind === "cover" && !config.coverPageNumbered) {
      romanCounter += 1;
      page.numberLabel = "";
      return;
    }
    romanCounter += 1;
    page.numberLabel = config.preliminaryNumbering === "roman-lower" ? roman(romanCounter) : "";
  });

  const pages = [...prelimPages, ...bodyPages].map((page, index) => ({ ...page, index: index + 1 }));

  return {
    pages,
    toc,
    listOfFigures,
    listOfTables,
    listOfAbbreviations,
    images: model.images ?? [],
    generatedAt: new Date().toISOString(),
  };
}

/** Second-pass audit over the rebuilt document. */
export function auditFinalDocument(final: FinalDocument, model: DocumentModel) {
  const findings: string[] = [];
  if (final.toc.length === 0) findings.push("Table of Contents is empty.");
  if (model.chapters.length === 0) findings.push("No chapters were detected in the main body.");
  const figureNumbers = final.listOfFigures.map((f) => f.label);
  if (new Set(figureNumbers).size !== figureNumbers.length)
    findings.push("Duplicate figure numbers remain after renumbering.");
  const tableNumbers = final.listOfTables.map((t) => t.label);
  if (new Set(tableNumbers).size !== tableNumbers.length)
    findings.push("Duplicate table numbers remain after renumbering.");
  model.abbreviations
    .filter((a) => a.requiresUserReview)
    .forEach((a) => findings.push(`Abbreviation "${a.abbreviation}" requires user review.`));
  final.listOfFigures
    .filter((f) => /requires_user_review/i.test(f.text))
    .forEach((f) => findings.push(`${f.label} caption requires user review.`));
  if (model.references.length === 0) findings.push("No reference list was detected.");

  return {
    checkedAt: new Date().toISOString(),
    pageCount: final.pages.length,
    figureCount: final.listOfFigures.length,
    tableCount: final.listOfTables.length,
    abbreviationCount: final.listOfAbbreviations.length,
    passed: findings.length === 0,
    findings,
  };
}