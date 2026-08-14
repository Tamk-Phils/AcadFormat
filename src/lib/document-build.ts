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

const CAPTION_REGEX = /^\s*(figure|table|fig|tbl)\s*\d+(?:\.\d+)*\b[:.\-–—]?/i;

function isOriginalCaption(line: string, chapter?: any): boolean {
  if (!chapter) return false;
  if (!CAPTION_REGEX.test(line)) return false;

  const cleanedLine = line.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const fig of chapter.figures || []) {
    const cleanedCaption = fig.caption.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanedCaption && (cleanedLine.includes(cleanedCaption) || cleanedCaption.includes(cleanedLine))) {
      return true;
    }
  }

  for (const tbl of chapter.tables || []) {
    const cleanedTitle = tbl.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanedTitle && (cleanedLine.includes(cleanedTitle) || cleanedTitle.includes(cleanedLine))) {
      return true;
    }
  }

  return false;
}

function isOriginalSectionTitle(line: string, chapter?: any): boolean {
  if (!chapter) return false;
  const cleanedLine = line.toLowerCase().replace(/[^a-z0-9]/g, "");

  const cleanedChapterTitle = chapter.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleanedChapterTitle && (cleanedLine === cleanedChapterTitle || cleanedLine.includes(cleanedChapterTitle))) {
    return true;
  }

  for (const sec of chapter.sections || []) {
    const cleanedTitle = sec.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanedTitle && (cleanedLine === cleanedTitle || cleanedLine.includes(cleanedTitle) || cleanedTitle.includes(cleanedLine))) {
      return true;
    }
  }

  return false;
}

function parseSectionContent(content: string, finalImages: { id: string }[], chapter?: any): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");

  let inTable = false;
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length === 0) return;

    const rows: string[][] = [];
    tableLines.forEach((line) => {
      let cells: string[] = [];
      if (line.includes("  |  ")) {
        cells = line.split("  |  ");
      } else if (line.includes("|")) {
        cells = line.split("|");
        if (line.trim().startsWith("|")) cells.shift();
        if (line.trim().endsWith("|")) cells.pop();
      } else if (line.includes("\t")) {
        cells = line.split("\t");
      } else {
        cells = [line];
      }

      const trimmedCells = cells.map((c) => c.trim());
      const isSeparator = trimmedCells.every((c) => !c || /^[:\-\s]+$/.test(c));
      if (!isSeparator && trimmedCells.some((c) => c.length > 0)) {
        rows.push(trimmedCells);
      }
    });

    if (rows.length > 0) {
      blocks.push({
        type: "table",
        text: tableLines.join("\n"),
        tableRows: rows,
      });
    }
    tableLines = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line) {
      if (inTable) flushTable();
      continue;
    }

    const imageMatch = line.match(/^\[IMAGE:(\d+)\]$/i) || line.match(/^\[IMAGE\]$/i);
    if (imageMatch) {
      if (inTable) flushTable();
      const imageIndex = imageMatch[1];
      const imageId = imageIndex !== undefined ? `img-${imageIndex}` : undefined;
      const exists = imageId ? finalImages.some((img) => img.id === imageId) : false;
      if (exists) {
        blocks.push({ type: "image", text: "", imageId });
      } else {
        blocks.push({ type: "center", text: `[ Figure Image ${imageIndex || ""} ]` });
      }
      continue;
    }

    const hasPipes = (line.match(/\|/g) || []).length >= 2;
    const isTableRow = inTable ||
      line.includes("  |  ") ||
      (line.startsWith("|") && line.endsWith("|")) ||
      (hasPipes && i + 1 < lines.length && /^[:\|\-\s]+$/.test(lines[i+1]!.trim()));

    if (isTableRow) {
      inTable = true;
      tableLines.push(lines[i]!);
    } else {
      if (inTable) flushTable();

      if (isStrayHeading(line)) {
        if (isOriginalSectionTitle(line, chapter)) {
          continue;
        }
        blocks.push({ type: "heading2", text: line });
      } else if (isOriginalCaption(line, chapter)) {
        continue;
      } else if (isOriginalSectionTitle(line, chapter)) {
        continue;
      } else {
        blocks.push({ type: "para", text: line });
      }
    }
  }

  if (inTable) flushTable();
  return blocks;
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
              : block.type === "table"
                ? 1000
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
  // Never leave a heading orphaned as the last line of a page.
  for (let i = 0; i < pages.length - 1; i += 1) {
    const page = pages[i]!;
    while (
      page.length > 1 &&
      (page[page.length - 1]!.type === "heading1" || page[page.length - 1]!.type === "heading2")
    ) {
      pages[i + 1]!.unshift(page.pop()!);
    }
  }
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

  const logoImages = (model.images ?? []).filter((image) => image.role === "logo");

  // ---- Chapters (figures and tables renumbered per the institutional rule) ----
  model.chapters.forEach((chapter, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    const chapterTitle = cleanTitle(chapter.title);

    // 1. Generate raw blocks
    const rawBlocks: Block[] = [
      { type: "heading1", text: `CHAPTER ${chapterNumber}: ${chapterTitle.toUpperCase()}` },
    ];

    const introBlocks = parseSectionContent(chapter.intro || "", model.images ?? [], chapter);
    rawBlocks.push(...introBlocks);

    const sectionPageMarks: { title: string; blockIndex: number }[] = [];
    chapter.sections.forEach((section, sectionIndex) => {
      const number = `${chapterNumber}.${sectionIndex + 1}`;
      const sectionTitle = cleanTitle(section.title);
      sectionPageMarks.push({ title: `${number} ${sectionTitle}`, blockIndex: rawBlocks.length });
      rawBlocks.push({ type: "heading2", text: `${number} ${sectionTitle}` });

      const sectionBlocks = parseSectionContent(section.content, model.images ?? [], chapter);
      rawBlocks.push(...sectionBlocks);
    });

    // 2. Post-process to insert captions, renumber figures and tables, and record page marks
    const blocks: Block[] = [];
    let figureIdx = 0;
    let tableIdx = 0;
    const figureMarks: { label: string; caption: string; blockIndex: number }[] = [];
    const tableMarks: { label: string; title: string; blockIndex: number }[] = [];

    const updatedSectionPageMarks: { title: string; blockIndex: number }[] = [];
    let rawIdx = 0;

    rawBlocks.forEach((block) => {
      const sectionMark = sectionPageMarks.find((m) => m.blockIndex === rawIdx);
      if (sectionMark) {
        updatedSectionPageMarks.push({ title: sectionMark.title, blockIndex: blocks.length });
      }

      if (block.type === "image") {
        const figure = chapter.figures[figureIdx];
        if (figure) {
          const label =
            config.figureNumbering === "chapter"
              ? `Figure ${chapterNumber}.${figureIdx + 1}`
              : `Figure ${listOfFigures.length + figureIdx + 1}`;

          blocks.push({
            ...block,
            text: figure.caption,
          });

          figureMarks.push({ label, caption: figure.caption, blockIndex: blocks.length });
          blocks.push({ type: "caption", text: `${label}: ${figure.caption}` });
          figureIdx += 1;
        } else {
          blocks.push(block);
        }
      } else if (block.type === "table") {
        const table = chapter.tables[tableIdx];
        if (table) {
          const label =
            config.tableNumbering === "chapter"
              ? `Table ${chapterNumber}.${tableIdx + 1}`
              : `Table ${listOfTables.length + tableIdx + 1}`;

          tableMarks.push({ label, title: table.title, blockIndex: blocks.length });
          blocks.push({ type: "caption", text: `${label}: ${table.title}` });
          blocks.push({
            ...block,
            text: table.title,
          });
          tableIdx += 1;
        } else {
          blocks.push(block);
        }
      } else {
        blocks.push(block);
      }

      rawIdx += 1;
    });

    // Handle any figures/tables defined in metadata but not encountered in section content:
    for (let f = figureIdx; f < chapter.figures.length; f += 1) {
      const figure = chapter.figures[f]!;
      const label =
        config.figureNumbering === "chapter"
          ? `Figure ${chapterNumber}.${f + 1}`
          : `Figure ${listOfFigures.length + f + 1}`;

      const imageId = `img-${f}`;
      const exists = model.images?.some((img) => img.id === imageId);

      if (exists) {
        blocks.push({ type: "image", text: figure.caption, imageId });
      } else {
        blocks.push({ type: "center", text: `[ ${figure.originalLabel || figure.kind || "Figure"} ]` });
      }
      figureMarks.push({ label, caption: figure.caption, blockIndex: blocks.length });
      blocks.push({ type: "caption", text: `${label}: ${figure.caption}` });
    }

    for (let t = tableIdx; t < chapter.tables.length; t += 1) {
      const table = chapter.tables[t]!;
      const label =
        config.tableNumbering === "chapter"
          ? `Table ${chapterNumber}.${t + 1}`
          : `Table ${listOfTables.length + t + 1}`;

      tableMarks.push({ label, title: table.title, blockIndex: blocks.length });
      blocks.push({ type: "caption", text: `${label}: ${table.title}` });
      blocks.push({ type: "center", text: `[ ${table.originalLabel || "Table content"} ]` });
    }

    const startPage = pushBody(`Chapter ${chapterNumber}`, blocks, "body");
    const pageOfBlock = (blockIndex: number) => {
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
      text: chapterTitle.toUpperCase(),
      page: String(startPage),
      level: 1,
    });

    updatedSectionPageMarks.forEach((mark) =>
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
      blocks.push({ type: "heading2", text: `${appendix.label}: ${cleanTitle(appendix.title)}` });
      const appendixBlocks = parseSectionContent(appendix.content, model.images ?? []);
      blocks.push(...appendixBlocks);
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
  const prelimSectionStarts = new Map<SectionType, number>();

  const addPrelim = (type: SectionType, sectionTitle: string, blocks: Block[], kind: "cover" | "preliminary") => {
    const startIndex = prelimPages.length;
    prelimSectionStarts.set(type, startIndex);
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
      ? [
          {
            type: "logos" as const,
            text: "",
            imageIds: logoImages
              .slice(0, Math.max(1, config.coverLogoCount))
              .map((image) => image.id),
          },
        ]
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

  // Construct complete Table of Contents entries.
  // First, we populate preliminary entries with placeholders, followed by the main body entries.
  const completeTOC: { label: string; text: string; page: string; level: number }[] = [];

  config.preliminaryOrder.forEach((type) => {
    if (type === "COVER_PAGE" || type === "TITLE_PAGE" || type === "TABLE_OF_CONTENTS") return;
    const title = PRELIM_TITLES[type] || type.replace(/_/g, " ");
    completeTOC.push({
      label: "",
      text: title.toUpperCase(),
      page: "ii", // temporary Roman numeral placeholder
      level: 1,
    });
  });

  // Append all main body entries (chapters, sections, references, appendices)
  completeTOC.push(...toc);

  for (const type of config.preliminaryOrder) {
    const title = PRELIM_TITLES[type] || type.replace(/_/g, " ");
    if (type === "COVER_PAGE") {
      addPrelim(type, "Cover Page", coverBlocks, "cover");
      continue;
    }
    if (type === "TITLE_PAGE") {
      addPrelim(type, "Title Page", coverBlocks, "preliminary");
      continue;
    }
    if (type === "TABLE_OF_CONTENTS") {
      // Chunk layout based on the full size of completeTOC
      addPrelim(type, "Table of Contents", [
        { type: "heading1", text: "TABLE OF CONTENTS" },
        ...completeTOC.map((entry) => ({
          type: "listline" as const,
          level: entry.level,
          bold: entry.level === 1,
          text: `${entry.label ? `${entry.label}: ` : ""}${entry.text}\t${entry.page}`,
        })),
      ], "preliminary");
      continue;
    }
    if (type === "LIST_OF_FIGURES") {
      addPrelim(type, "List of Figures", [
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
      addPrelim(type, "List of Tables", [
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
      addPrelim(type, "List of Abbreviations", [
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
    addPrelim(type, title, [
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

  // Map preliminary sections to their resolved page numbers
  const prelimSectionPages = new Map<SectionType, string>();
  prelimSectionStarts.forEach((startIndex, secType) => {
    const pageLabel = prelimPages[startIndex]?.numberLabel || "";
    prelimSectionPages.set(secType, pageLabel);
  });

  // Update completeTOC entries with the actual roman page numbers
  let pIdx = 0;
  config.preliminaryOrder.forEach((secType) => {
    if (secType === "COVER_PAGE" || secType === "TITLE_PAGE" || secType === "TABLE_OF_CONTENTS") return;
    const page = prelimSectionPages.get(secType) || "";
    if (completeTOC[pIdx]) {
      completeTOC[pIdx]!.page = page;
    }
    pIdx += 1;
  });

  // Re-apply the updated completeTOC to the TOC pages blocks
  const tocStartIndex = prelimSectionStarts.get("TABLE_OF_CONTENTS");
  if (tocStartIndex !== undefined) {
    const tocBlocks: Block[] = [
      { type: "heading1", text: "TABLE OF CONTENTS" },
      ...completeTOC.map((entry) => ({
        type: "listline" as const,
        level: entry.level,
        bold: entry.level === 1,
        text: `${entry.label ? `${entry.label}: ` : ""}${entry.text}\t${entry.page}`,
      })),
    ];
    const tocPages = chunkBlocks(tocBlocks);
    tocPages.forEach((pageBlocks, offset) => {
      const pageIndex = tocStartIndex + offset;
      if (prelimPages[pageIndex]) {
        prelimPages[pageIndex]!.blocks = pageBlocks;
      }
    });
  }

  const pages = [...prelimPages, ...bodyPages].map((page, index) => ({ ...page, index: index + 1 }));

  return {
    pages,
    toc: completeTOC,
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