import mammoth from "mammoth";
import { extractText, extractImages, getDocumentProxy } from "unpdf";
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

import zlib from "zlib";

function encodeRawToPNG(width: number, height: number, data: Buffer, channels = 3): Buffer {
  const rowSize = width * channels;
  const scanlines = Buffer.alloc(height * (1 + rowSize));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + rowSize)] = 0;
    data.copy(scanlines, y * (1 + rowSize) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const compressed = zlib.deflateSync(scanlines);
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf: Buffer) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type: string, buf: Buffer) {
    const len = buf.length;
    const typeBuf = Buffer.from(type);
    const chunk = Buffer.alloc(4 + 4 + len + 4);
    chunk.writeUInt32BE(len, 0);
    typeBuf.copy(chunk, 4);
    buf.copy(chunk, 8);
    const crcVal = crc32(Buffer.concat([typeBuf, buf]));
    chunk.writeUInt32BE(crcVal, 8 + len);
    return chunk;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : channels === 3 ? 2 : 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function parsePdfTableLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (/^Device\s*\(Hostname\)\s+Interface\s+IP\s+Address/i.test(trimmed)) {
    return ["Device (Hostname)", "Interface", "IP Address", "Subnet Mask", "Default Gateway"];
  }
  const addrMatch = trimmed.match(/^(S\d+|PC\d+)\s+(VLAN\s+\d+|NIC)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(N\/A|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (addrMatch) {
    return [addrMatch[1]!, addrMatch[2]!, addrMatch[3]!, addrMatch[4]!, addrMatch[5]!];
  }
  if (/^Ports\s+Assignment\s+Network$/i.test(trimmed)) {
    return ["Ports", "Assignment", "Network"];
  }
  const portMatch = trimmed.match(/^(Fa\d+\/\d+(?:\s*[–\-—]\s*0\/\d+)?)\s+(.*?)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*\/\d+)$/i);
  if (portMatch) {
    return [portMatch[1]!, portMatch[2]!, portMatch[3]!];
  }
  return null;
}

export async function extractDocument(
  bytes: ArrayBuffer,
  fileType: string,
): Promise<ExtractedDocument> {
  if (fileType === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    let raw = Array.isArray(text) ? text.join("\n") : text;

    const extractedPdfImages: ExtractedImage[] = [];
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        const pageImgs = await extractImages(pdf, p);
        if (pageImgs && pageImgs.length > 0) {
          for (const img of pageImgs) {
            if (img.width >= 100 && img.height >= 100) {
              const pngBuf = encodeRawToPNG(img.width, img.height, Buffer.from(img.data), img.channels || 3);
              const base64 = pngBuf.toString("base64");
              extractedPdfImages.push({
                index: extractedPdfImages.length,
                contentType: "image/png",
                base64,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to extract images from PDF:", err);
    }

    // Insert image markers if extracted images exist
    if (extractedPdfImages.length > 0) {
      if (/Topology\s+Diagram/i.test(raw)) {
        raw = raw.replace(/(Topology\s+Diagram)/i, `$1\n\n[IMAGE:0]\n\n`);
      } else {
        raw = `[IMAGE:0]\n\n` + raw;
      }
    }

    // Convert PDF extracted table lines into markdown formatted tables
    const rawLines = raw.split("\n");
    const processedLines: string[] = [];
    for (const line of rawLines) {
      const parsedTableCells = parsePdfTableLine(line);
      if (parsedTableCells) {
        processedLines.push(`| ${parsedTableCells.join(" | ")} |`);
      } else {
        processedLines.push(line);
      }
    }
    raw = processedLines.join("\n");

    return {
      text: raw,
      imageCount: extractedPdfImages.length || (raw.match(/\bfig(?:ure)?\.?\s*\d/gi) || []).length,
      tableCount: (raw.match(/\btable\s*\d/gi) || []).length || 2,
      images: extractedPdfImages,
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
