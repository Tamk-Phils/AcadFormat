import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

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

  return { text, imageCount: images.length, tableCount, images };
}
