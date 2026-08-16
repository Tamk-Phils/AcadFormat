import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { OriginalBlock } from "./document-model";

export interface ExtractedImage {
  index: number;
  contentType: string;
  base64: string;
}

export interface ExtractedDocument {
  text: string;
  imageCount: number;
  tableCount: number;
  images: ExtractedImage[];
  /** Ordered, unmodified blocks of the uploaded file for the "original" preview. */
  original: OriginalBlock[];
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Walk the mammoth HTML in document order, keeping headings, paragraphs, images and tables. */
function htmlToOriginalBlocks(html: string): OriginalBlock[] {
  const blocks: OriginalBlock[] = [];
  const pattern =
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|<table[\s\S]*?<\/table>|<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const chunk = match[0];
    if (/^<table/i.test(chunk)) {
      const rows: string[][] = [];
      const trMatches = chunk.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const trHtml of trMatches) {
        const cellMatches = trHtml.match(/<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi) || [];
        const cells = cellMatches.map((cellHtml) => sanitizeTableCell(cellHtml));
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) {
        const mdText = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
        blocks.push({ type: "table", text: mdText, tableRows: rows });
      }
      continue;
    }
    const inner = match[2] ?? match[3] ?? "";
    const images = inner.match(/<img[^>]*src="acadformat-image:(\d+)"[^>]*>/g) ?? [];
    for (const image of images) {
      const index = image.match(/acadformat-image:(\d+)/)?.[1];
      if (index !== undefined) blocks.push({ type: "image", text: "", imageId: `img-${index}` });
    }
    const text = stripTags(inner);
    if (!text) continue;
    if (match[1]) blocks.push({ type: "heading", text, level: Number(match[1]) });
    else blocks.push({ type: "para", text });
  }
  return blocks;
}

function sanitizeTableCell(cellHtml: string): string {
  const text = stripTags(cellHtml).replace(/\s+/g, " ").trim();
  // Replace pipe characters inside cell text so markdown format parser doesn't treat them as column delimiters
  return text.replace(/\|/g, "&#124;");
}

function convertHtmlTablesToMarkdown(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows: string[][] = [];
    const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const trHtml of trMatches) {
      const cellMatches = trHtml.match(/<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi) || [];
      const cells = cellMatches.map((cellHtml) => sanitizeTableCell(cellHtml));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return "\n[TABLE]\n";
    const mdLines: string[] = [];
    const header = rows[0]!;
    mdLines.push(`| ${header.join(" | ")} |`);
    mdLines.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (let i = 1; i < rows.length; i += 1) {
      mdLines.push(`| ${rows[i]!.join(" | ")} |`);
    }
    return `\n\n${mdLines.join("\n")}\n\n`;
  });
}

export async function extractDocument(
  bytes: ArrayBuffer,
  fileType: string,
): Promise<ExtractedDocument> {
  if (fileType === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n") : text;
    return {
      text: raw,
      imageCount: (raw.match(/\bfig(?:ure)?\.?\s*\d/gi) || []).length,
      tableCount: (raw.match(/\btable\s*\d/gi) || []).length,
      images: [],
      original: raw
        .split(/\n{2,}|\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ type: "para" as const, text: line })),
    };
  }

  const images: ExtractedImage[] = [];
  const { value: html } = await mammoth.convertToHtml(
    { buffer: Buffer.from(bytes) },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.readAsBase64String();
        const index = images.length;
        images.push({ index, contentType: image.contentType || "image/png", base64 });
        return { src: `acadformat-image:${index}` };
      }),
    },
  );

  const tableCount = (html.match(/<table/g) || []).length;
  const htmlWithMarkdownTables = convertHtmlTablesToMarkdown(html);
  const text = htmlWithMarkdownTables
    .replace(/<img[^>]*src="acadformat-image:(\d+)"[^>]*>/g, "\n[IMAGE:$1]\n")
    .replace(/<img[^>]*>/g, "\n[IMAGE]\n")
    .replace(/<\/(p|h1|h2|h3|h4|li|tr)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n");

  return {
    text,
    imageCount: images.length,
    tableCount,
    images,
    original: htmlToOriginalBlocks(html),
  };
}
