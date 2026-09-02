import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { FinalDocument } from "./document-model";
import type { InstitutionConfig } from "./institutions";
import { parseTableRows } from "./utils";

export interface PdfImageAsset {
  data: Uint8Array;
  contentType: string;
}

const PT_PER_INCH = 72;
const PAGE_WIDTH = 8.5 * PT_PER_INCH;
const PAGE_HEIGHT = 11 * PT_PER_INCH;

/** Thoroughly sanitize glyphs to prevent pdf-lib WinAnsi encoding exceptions. */
export function sanitizeWinAnsi(text: string, font?: PDFFont): string {
  if (!text) return "";
  
  let clean = text
    // Replace bullet points & MS Word symbols with standard WinAnsi bullet
    .replace(/[\uF0B7\uF0D8\uF0A7\u25AA\u25B6\u25BA\u25CF\u25CB\u25A0\u25A1\u25C6\u25C7]/g, "•")
    // Smart quotes & hyphens
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    // Common math & arrow symbols
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2260/g, "!=")
    .replace(/\u2248/g, "~=")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u21D2/g, "=>")
    // Remove zero-width & non-printable control characters
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "");

  if (font && typeof (font as any).encodeText === "function") {
    let safe = "";
    for (const char of clean) {
      try {
        (font as any).encodeText(char);
        safe += char;
      } catch {
        safe += " ";
      }
    }
    return safe;
  }

  return clean.replace(/[^\x09\x0A\x20-\x7E\u00A0-\u00FF]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const cleanText = sanitizeWinAnsi(text, font);
  const words = cleanText.split(/\s+/).filter(Boolean);
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

export async function buildPdf(
  final: FinalDocument,
  config: InstitutionConfig,
  images: Map<string, PdfImageAsset> = new Map(),
): Promise<string> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const mono = await pdf.embedFont(StandardFonts.Courier);

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

  let sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin.top;
  let currentLabel = "";

  const stamp = (target: typeof sheet, label: string) => {
    if (!label) return;
    const cleanLabel = sanitizeWinAnsi(label, regular);
    const width = regular.widthOfTextAtSize(cleanLabel, baseSize);
    target.drawText(cleanLabel, {
      x: (PAGE_WIDTH - width) / 2,
      y: margin.bottom / 2,
      size: baseSize,
      font: regular,
      color: rgb(0, 0, 0),
    });
  };

  const ensure = (needed: number) => {
    if (y - needed >= margin.bottom) return;
    stamp(sheet, currentLabel);
    sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - margin.top;
  };

  let isFirstPage = true;

  for (const page of final.pages) {
    if (!isFirstPage) {
      stamp(sheet, currentLabel);
      sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin.top;
    }
    isFirstPage = false;
    currentLabel = page.numberLabel || "";

    if (page.hasPageBorder) {
      sheet.drawRectangle({
        x: margin.left - 10,
        y: margin.bottom - 10,
        width: contentWidth + 20,
        height: PAGE_HEIGHT - margin.top - margin.bottom + 20,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
    }

    const write = (
      text: string,
      options: { font: PDFFont; size: number; align?: "left" | "center" | "justify" },
    ) => {
      if (!text || !text.trim()) return;
      const lines = wrap(text, options.font, options.size, contentWidth);
      for (let i = 0; i < lines.length; i++) {
        const line = sanitizeWinAnsi(lines[i] || "", options.font);
        ensure(leading);
        
        if (options.align === "justify" && i < lines.length - 1 && line.includes(" ")) {
          const words = line.split(" ");
          const textWidthWithoutSpaces = words.reduce((sum, word) => sum + options.font.widthOfTextAtSize(sanitizeWinAnsi(word, options.font), options.size), 0);
          const spaceToDistribute = contentWidth - textWidthWithoutSpaces;
          const spaceWidth = spaceToDistribute / (words.length - 1);
          
          let currentX = margin.left;
          for (const word of words) {
            const cleanWord = sanitizeWinAnsi(word, options.font);
            sheet.drawText(cleanWord, { x: currentX, y: y - options.size, size: options.size, font: options.font });
            currentX += options.font.widthOfTextAtSize(cleanWord, options.size) + spaceWidth;
          }
        } else {
          const width = options.font.widthOfTextAtSize(line, options.size);
          const x = options.align === "center" ? margin.left + (contentWidth - width) / 2 : margin.left;
          sheet.drawText(line, { x, y: y - options.size, size: options.size, font: options.font });
        }
        y -= leading;
      }
    };

    for (const block of page.blocks) {
      if (block.type === "spacer") {
        y -= Math.min(leading, 12);
        continue;
      }
      if (block.type === "bilingual") {
        const leftLines = block.left || [];
        const rightLines = block.right || [];
        const count = Math.max(leftLines.length, rightLines.length);

        const ids = block.imageIds ?? [];
        const assets = ids.map((id) => embedded.get(id)).filter((a): a is PDFImage => Boolean(a));
        const hasLogos = assets.length > 0;

        let logoHeight = 0;
        let scaledAssets: { asset: PDFImage, width: number, height: number }[] = [];
        if (hasLogos) {
          const maxHeight = 60;
          scaledAssets = assets.map((asset) => {
            const ratio = maxHeight / asset.height;
            return { asset, width: asset.width * ratio, height: asset.height * ratio };
          });
          logoHeight = Math.max(...scaledAssets.map(s => s.height));
        }

        const totalHeight = Math.max(count * leading, logoHeight);
        ensure(totalHeight + 12);

        let tempY = y;
        for (const rawLine of leftLines) {
          const line = sanitizeWinAnsi(rawLine, bold);
          sheet.drawText(line, { x: margin.left, y: tempY - 10, font: bold, size: baseSize - 2 });
          tempY -= leading;
        }

        tempY = y;
        for (const rawLine of rightLines) {
          const line = sanitizeWinAnsi(rawLine, bold);
          const textWidth = bold.widthOfTextAtSize(line, baseSize - 2);
          sheet.drawText(line, { x: margin.left + contentWidth - textWidth, y: tempY - 10, font: bold, size: baseSize - 2 });
          tempY -= leading;
        }

        if (hasLogos) {
          const totalWidth = scaledAssets.reduce((sum, s) => sum + s.width, 0) + 10 * (scaledAssets.length - 1);
          let startX = margin.left + (contentWidth - totalWidth) / 2;
          for (const item of scaledAssets) {
            sheet.drawImage(item.asset, { x: startX, y: y - item.height, width: item.width, height: item.height });
            startX += item.width + 10;
          }
        }

        y -= totalHeight + 12;
        continue;
      }
      if (block.type === "ubaHeader") {
        const ubaLogoAsset = embedded.get("logo-uba");
        const secondaryLogoId = block.imageIds?.find(id => id !== "logo-uba");
        const secondaryLogoAsset = secondaryLogoId ? embedded.get(secondaryLogoId) : undefined;

        ensure(110);

        // Draw left logo
        if (ubaLogoAsset) {
          const ratio = 48 / ubaLogoAsset.height;
          sheet.drawImage(ubaLogoAsset, {
            x: margin.left,
            y: y - 55,
            width: ubaLogoAsset.width * ratio,
            height: 48,
          });
        }

        // Draw right logo
        if (secondaryLogoAsset) {
          const ratio = 48 / secondaryLogoAsset.height;
          sheet.drawImage(secondaryLogoAsset, {
            x: margin.left + contentWidth - secondaryLogoAsset.width * ratio,
            y: y - 55,
            width: secondaryLogoAsset.width * ratio,
            height: 48,
          });
        }

        // Draw center text
        let textY = y - 10;
        const drawCenterLine = (txt: string, isBold = false, sz = baseSize - 3) => {
          const fn = isBold ? bold : regular;
          const cleanTxt = sanitizeWinAnsi(txt, fn);
          const textW = fn.widthOfTextAtSize(cleanTxt, sz);
          sheet.drawText(cleanTxt, {
            x: margin.left + (contentWidth - textW) / 2,
            y: textY,
            font: fn,
            size: sz,
          });
          textY -= 10;
        };

        (block.left || []).forEach((line, idx) => {
          if (line === "") {
            textY -= 4;
            return;
          }
          const isBold = idx === 0 || idx === 2 || idx === 5 || idx === 8;
          const sz = idx === 5 ? baseSize - 2 : (idx === 6 || idx === 7 || idx === 9) ? baseSize - 4 : baseSize - 3;
          drawCenterLine(line, isBold, sz);
        });

        // Draw divider horizontal line
        y = textY - 5;
        sheet.drawLine({
          start: { x: margin.left, y },
          end: { x: margin.left + contentWidth, y },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
        y -= 15;
        continue;
      }
      if (block.type === "logos" || block.type === "image") {
        const ids = block.type === "logos" ? (block.imageIds ?? []) : block.imageId ? [block.imageId] : [];
        const assets = ids.map((id) => embedded.get(id)).filter((a): a is PDFImage => Boolean(a));
        if (assets.length === 0) {
          if (block.type === "image") {
            const figText = sanitizeWinAnsi(block.text || "Figure Illustration", italic);
            ensure(35);
            sheet.drawRectangle({
              x: margin.left + 40,
              y: y - 30,
              width: contentWidth - 80,
              height: 30,
              borderColor: rgb(0.5, 0.5, 0.5),
              borderWidth: 1,
            });
            const textWidth = italic.widthOfTextAtSize(figText, baseSize - 1);
            sheet.drawText(figText, {
              x: margin.left + (contentWidth - textWidth) / 2,
              y: y - 20,
              size: baseSize - 1,
              font: italic,
              color: rgb(0.3, 0.3, 0.3),
            });
            y -= 40;
          }
          continue;
        }
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
      if (block.type === "title") {
        if (block.borderBox) {
          const cleanBoxText = sanitizeWinAnsi(block.text, bold);
          const titleLines = wrap(cleanBoxText, bold, 16, contentWidth - 40);
          const boxHeight = titleLines.length * (16 * config.lineSpacing) + 30;
          ensure(boxHeight);
          sheet.drawRectangle({
            x: margin.left,
            y: y - boxHeight,
            width: contentWidth,
            height: boxHeight,
            borderColor: rgb(0.17, 0.42, 0.69),
            borderWidth: 2,
          });
          let textY = y - 15;
          for (const line of titleLines) {
            const cleanLine = sanitizeWinAnsi(line, bold);
            const width = bold.widthOfTextAtSize(cleanLine, 16);
            sheet.drawText(cleanLine, {
              x: margin.left + (contentWidth - width) / 2,
              y: textY - 16,
              size: 16,
              font: bold,
              color: rgb(0, 0, 0),
            });
            textY -= 16 * config.lineSpacing;
          }
          y -= boxHeight + 10;
        } else {
          write(block.text, { font: bold, size: 16, align: "center" });
        }
      } else if (block.type === "center") {
        const font = block.italic ? italic : (block.bold ? bold : regular);
        const size = block.size || 14;
        write(block.text, { font, size, align: "center" });
      }
      else if (block.type === "heading1")
        write(block.text, { font: bold, size: baseSize + 2, align: "center" });
      else if (block.type === "heading2") write(block.text, { font: bold, size: baseSize });
      else if (block.type === "caption")
        write(block.text, { font: italic, size: baseSize - 1, align: "center" });
      else if (block.type === "listline") {
        const textStr = typeof block.text === "string" ? block.text : String(block.text ?? "");
        const [left, right] = textStr.split("\t");
        const isBold = block.bold === true || block.level === 1;
        const font = isBold ? bold : regular;

        y -= 1;
        const indentWidth = Math.max(0, (block.level ?? 1) - 1) * 20;

        const isReference = page.sectionTitle?.toLowerCase() === "references";
        const hangingIndent = isReference ? 36 : 0;

        if (!right) {
          const lines = wrap(left || "", font, baseSize, contentWidth - indentWidth - hangingIndent);
          for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i]!;
            const line = sanitizeWinAnsi(rawLine, font);
            ensure(leading);
            const currentIndent = i === 0 ? indentWidth : indentWidth + hangingIndent;
            sheet!.drawText(line, { x: margin.left + currentIndent, y: y - baseSize, size: baseSize, font });
            y -= leading;
          }
        } else {
          const cleanRight = sanitizeWinAnsi(right, font);
          const rightWidth = font.widthOfTextAtSize(cleanRight, baseSize);
          const lines = wrap(left || "", font, baseSize, contentWidth - indentWidth - hangingIndent - rightWidth - 20);

          for (let i = 0; i < lines.length; i++) {
            const line = sanitizeWinAnsi(lines[i] || "", font);
            ensure(leading);
            const currentIndent = i === 0 ? indentWidth : indentWidth + hangingIndent;
            sheet!.drawText(line, { x: margin.left + currentIndent, y: y - baseSize, size: baseSize, font });

            if (i === lines.length - 1) {
              sheet!.drawText(cleanRight, { x: margin.left + contentWidth - rightWidth, y: y - baseSize, size: baseSize, font });

              const lastLineWidth = font.widthOfTextAtSize(line, baseSize);
              const dotStartX = margin.left + currentIndent + lastLineWidth + 5;
              const dotEndX = margin.left + contentWidth - rightWidth - 5;
              let currentX = dotStartX;
              while (currentX < dotEndX - 5) {
                sheet!.drawText(".", { x: currentX, y: y - baseSize, size: baseSize, font: regular });
                currentX += 6;
              }
            }
            y -= leading;
          }
        }
        y -= 1;
      } else if (block.type === "table") {
        const rows = parseTableRows(block);

        if (rows.length > 0) {
          const colsCount = Math.max(1, ...rows.map((r) => r.length));
          const colWidth = contentWidth / colsCount;
          const cellFontSize = Math.max(7.5, colsCount >= 4 ? baseSize - 3.5 : baseSize - 2);
          const cellLeading = cellFontSize * 1.3;

          for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
            const row = rows[rIdx]!;
            const rowFont = rIdx === 0 ? bold : regular;

            const wrappedCells = row.map((cell) =>
              wrap(cell, rowFont, cellFontSize, colWidth - 8),
            );
            const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
            const rowHeight = maxLines * cellLeading + 8;

            ensure(rowHeight);
            const rowTopY = y;

            if (rIdx === 0) {
              sheet.drawRectangle({
                x: margin.left,
                y: rowTopY - rowHeight,
                width: contentWidth,
                height: rowHeight,
                color: rgb(0.92, 0.94, 0.96),
              });
            }

            // Draw top border line of this row
            sheet.drawLine({
              start: { x: margin.left, y: rowTopY },
              end: { x: margin.left + contentWidth, y: rowTopY },
              thickness: rIdx === 0 ? 1.2 : 0.75,
              color: rgb(0, 0, 0),
            });

            for (let cIdx = 0; cIdx < row.length; cIdx += 1) {
              const cellLines = wrappedCells[cIdx]!;
              let cellY = rowTopY - 4;
              for (const rawLine of cellLines) {
                const line = sanitizeWinAnsi(rawLine, rowFont);
                sheet.drawText(line, {
                  x: margin.left + cIdx * colWidth + 4,
                  y: cellY - cellFontSize,
                  size: cellFontSize,
                  font: rowFont,
                });
                cellY -= cellLeading;
              }
            }

            y -= rowHeight;

            // Draw bottom border line of this row
            sheet.drawLine({
              start: { x: margin.left, y },
              end: { x: margin.left + contentWidth, y },
              thickness: rIdx === rows.length - 1 ? 1.2 : 0.75,
              color: rgb(0, 0, 0),
            });

            // Draw per-row vertical column grid lines
            for (let cIdx = 0; cIdx <= colsCount; cIdx += 1) {
              sheet.drawLine({
                start: { x: margin.left + cIdx * colWidth, y: rowTopY },
                end: { x: margin.left + cIdx * colWidth, y },
                thickness: 0.75,
                color: rgb(0, 0, 0),
              });
            }
          }
        }
        y -= 12;
      } else if (block.type === "code") {
        const codeLines = sanitizeWinAnsi(block.text || "", mono).split("\n");
        const fontSize = Math.max(8, baseSize - 2);
        const codeLeading = fontSize * 1.3;
        const blockHeight = codeLines.length * codeLeading + 10;

        ensure(blockHeight);
        sheet.drawRectangle({
          x: margin.left,
          y: y - blockHeight,
          width: contentWidth,
          height: blockHeight,
          color: rgb(0.95, 0.95, 0.97),
          borderColor: rgb(0.8, 0.8, 0.85),
          borderWidth: 0.5,
        });

        let codeY = y - 6;
        for (const rawLine of codeLines) {
          const line = sanitizeWinAnsi(rawLine, mono);
          sheet.drawText(line, {
            x: margin.left + 8,
            y: codeY - fontSize,
            size: fontSize,
            font: mono,
            color: rgb(0.1, 0.1, 0.2),
          });
          codeY -= codeLeading;
        }
        y -= blockHeight + 8;
      } else write(block.text, { font: regular, size: baseSize, align: "justify" });
    }
  }

  stamp(sheet, currentLabel);

  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
}