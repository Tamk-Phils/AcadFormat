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
      const rows = chunk
        .split(/<\/tr>/i)
        .map((row) =>
          row
            .split(/<\/t[dh]>/i)
            .map(stripTags)
            .filter(Boolean)
            .join("  |  "),
        )
        .filter(Boolean);
      blocks.push({ type: "table", text: rows.join("\n") });
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
    { arrayBuffer: bytes },
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
  const text = html
    .replace(/<img[^>]*src="acadformat-image:(\d+)"[^>]*>/g, "\n[IMAGE:$1]\n")
    .replace(/<img[^>]*>/g, "\n[IMAGE]\n")
    .replace(/<\/(p|h1|h2|h3|h4|li|tr)>/g, "\n")
    .replace(/<table[^>]*>/g, "\n[TABLE]\n")
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
