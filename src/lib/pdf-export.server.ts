import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { FinalDocument } from "./document-model";
import type { InstitutionConfig } from "./institutions";

export interface PdfImageAsset {
  data: Uint8Array;
  contentType: string;
}

const PT_PER_INCH = 72;
const PAGE_WIDTH = 8.5 * PT_PER_INCH;
const PAGE_HEIGHT = 11 * PT_PER_INCH;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

/** Strip glyphs the PDF standard fonts (WinAnsi) cannot encode. */
function sanitize(text: string) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x20-\x7E\u00A0-\u00FF]/g, "");
}

export async function buildPdf(
  final: FinalDocument,
  config: InstitutionConfig,
  images: Map<string, PdfImageAsset> = new Map(),
): Promise<string> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const embedded = new Map<string, PDFImage>();
  for (const [id, asset] of images) {
    try {
      embedded.set(
        id,
        /jpe?g/i.test(asset.contentType)
          ? await pdf.embedJpg(asset.data)
          : await pdf.embedPng(asset.data),
      );
    } catch {
      // Unsupported image format for PDF embedding — skip it.
    }
  }

  const margin = {
    top: config.marginsIn.top * PT_PER_INCH,
    bottom: config.marginsIn.bottom * PT_PER_INCH,
    left: config.marginsIn.left * PT_PER_INCH,
    right: config.marginsIn.right * PT_PER_INCH,
  };
  const contentWidth = PAGE_WIDTH - margin.left - margin.right;
  const baseSize = config.fontSizePt;
  const leading = baseSize * config.lineSpacing;

  for (const page of final.pages) {
    let sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - margin.top;
    const label = page.numberLabel;

    const stamp = (target: typeof sheet) => {
      if (!label) return;
      const width = regular.widthOfTextAtSize(label, baseSize);
      target.drawText(label, {
        x: (PAGE_WIDTH - width) / 2,
        y: margin.bottom / 2,
        size: baseSize,
        font: regular,
        color: rgb(0, 0, 0),
      });
    };

    const ensure = (needed: number) => {
      if (y - needed >= margin.bottom) return;
      stamp(sheet);
      sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin.top;
    };

    const write = (
      text: string,
      options: { font: PDFFont; size: number; align?: "left" | "center" | "justify" },
    ) => {
      const lines = wrap(sanitize(text), options.font, options.size, contentWidth);
      for (const line of lines) {
        ensure(leading);
        const width = options.font.widthOfTextAtSize(line, options.size);
        const x = options.align === "center" ? margin.left + (contentWidth - width) / 2 : margin.left;
        sheet.drawText(line, { x, y: y - options.size, size: options.size, font: options.font });
        y -= leading;
      }
    };

    for (const block of page.blocks) {
      if (block.type === "spacer") {
        y -= leading;
        continue;
      }
      if (block.type === "logos" || block.type === "image") {
        const ids = block.type === "logos" ? (block.imageIds ?? []) : block.imageId ? [block.imageId] : [];
        const assets = ids.map((id) => embedded.get(id)).filter((a): a is PDFImage => Boolean(a));
        if (assets.length === 0) continue;
        const maxHeight = block.type === "logos" ? 70 : 250;
        const scaled = assets.map((asset) => {
          const ratio = Math.min(
            (contentWidth / assets.length - 12) / asset.width,
            maxHeight / asset.height,
          );
          return { asset, width: asset.width * ratio, height: asset.height * ratio };
        });
        const rowHeight = Math.max(...scaled.map((s) => s.height));
        ensure(rowHeight + 12);
        const totalWidth = scaled.reduce((sum, s) => sum + s.width, 0) + 20 * (scaled.length - 1);
        let x = margin.left + (contentWidth - totalWidth) / 2;
        for (const item of scaled) {
          sheet.drawImage(item.asset, { x, y: y - item.height, width: item.width, height: item.height });
          x += item.width + 20;
        }
        y -= rowHeight + 12;
        continue;
      }
      if (block.type === "title") write(block.text, { font: bold, size: 16, align: "center" });
      else if (block.type === "center") write(block.text, { font: regular, size: 14, align: "center" });
      else if (block.type === "heading1")
        write(block.text, { font: bold, size: baseSize + 2, align: "center" });
      else if (block.type === "heading2") write(block.text, { font: bold, size: baseSize });
      else if (block.type === "caption")
        write(block.text, { font: italic, size: baseSize - 1, align: "center" });
      else if (block.type === "listline") {
        const [left, right] = block.text.split("\t");
        write(right ? `${left}  ......  ${right}` : (left ?? ""), { font: regular, size: baseSize });
      } else write(block.text, { font: regular, size: baseSize });
    }

    stamp(sheet);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
}