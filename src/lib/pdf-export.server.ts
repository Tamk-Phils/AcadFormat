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

  let sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin.top;
  let currentLabel = "";

  const stamp = (target: typeof sheet, label: string) => {
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
    stamp(sheet, currentLabel);
    sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - margin.top;
  };

  let isFirstPage = true;

  for (const page of final.pages) {
    if (page.startsSection && !isFirstPage) {
      stamp(sheet, currentLabel);
      sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin.top;
    }
    isFirstPage = false;
    currentLabel = page.numberLabel || currentLabel;

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
      const lines = wrap(sanitize(text), options.font, options.size, contentWidth);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || "";
        ensure(leading);
        
        if (options.align === "justify" && i < lines.length - 1 && line.includes(" ")) {
          const words = line.split(" ");
          const textWidthWithoutSpaces = words.reduce((sum, word) => sum + options.font.widthOfTextAtSize(word, options.size), 0);
          const spaceToDistribute = contentWidth - textWidthWithoutSpaces;
          const spaceWidth = spaceToDistribute / (words.length - 1);
          
          let currentX = margin.left;
          for (const word of words) {
            sheet.drawText(word, { x: currentX, y: y - options.size, size: options.size, font: options.font });
            currentX += options.font.widthOfTextAtSize(word, options.size) + spaceWidth;
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
        y -= leading;
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
        for (const line of leftLines) {
          sheet.drawText(line, { x: margin.left, y: tempY - 10, font: bold, size: baseSize - 2 });
          tempY -= leading;
        }

        tempY = y;
        for (const line of rightLines) {
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
          const textW = fn.widthOfTextAtSize(txt, sz);
          sheet.drawText(txt, {
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
            const figText = block.text || "Figure Illustration";
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
          const titleLines = wrap(sanitize(block.text), bold, 16, contentWidth - 40);
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
            const width = bold.widthOfTextAtSize(line, 16);
            sheet.drawText(line, {
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
        const [left, right] = block.text.split("\t");
        const isBold = block.bold === true || block.level === 1;
        const font = isBold ? bold : regular;

        y -= 6;
        const indentWidth = Math.max(0, (block.level ?? 1) - 1) * 20;

        if (!right) {
          const lines = wrap(sanitize(left || ""), font, baseSize, contentWidth - indentWidth);
          for (const line of lines) {
            ensure(leading);
            sheet!.drawText(line, { x: margin.left + indentWidth, y: y - baseSize, size: baseSize, font });
            y -= leading;
          }
        } else {
          const rightWidth = font.widthOfTextAtSize(right, baseSize);
          const lines = wrap(sanitize(left || ""), font, baseSize, contentWidth - indentWidth - rightWidth - 20);

          for (let i = 0; i < lines.length; i++) {
            ensure(leading);
            sheet!.drawText(lines[i] || "", { x: margin.left + indentWidth, y: y - baseSize, size: baseSize, font });

            if (i === lines.length - 1) {
              sheet!.drawText(right, { x: margin.left + contentWidth - rightWidth, y: y - baseSize, size: baseSize, font });

              const lastLineWidth = font.widthOfTextAtSize(lines[i] || "", baseSize);
              const dotStartX = margin.left + indentWidth + lastLineWidth + 5;
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
        y -= 6;
      } else if (block.type === "table") {
        const rows = parseTableRows(block);

        if (rows.length > 0) {
          const colsCount = Math.max(...rows.map((r) => r.length));
          const colWidth = contentWidth / colsCount;
          const tableTopY = y;

          ensure(6);
          sheet.drawLine({
            start: { x: margin.left, y },
            end: { x: margin.left + contentWidth, y },
            thickness: 1,
            color: rgb(0, 0, 0),
          });
          y -= 4;

          for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
            const row = rows[rIdx]!;
            const rowFont = rIdx === 0 ? bold : regular;

            const wrappedCells = row.map((cell) =>
              wrap(sanitize(cell), rowFont, baseSize, colWidth - 10),
            );
            const maxLines = Math.max(...wrappedCells.map((lines) => lines.length));
            const rowHeight = maxLines * leading + 8;

            ensure(rowHeight);

            for (let cIdx = 0; cIdx < row.length; cIdx += 1) {
              const cellLines = wrappedCells[cIdx]!;
              let cellY = y - 4;
              for (const line of cellLines) {
                sheet.drawText(line, {
                  x: margin.left + cIdx * colWidth + 5,
                  y: cellY - baseSize,
                  size: baseSize,
                  font: rowFont,
                });
                cellY -= leading;
              }
            }

            y -= rowHeight;

            sheet.drawLine({
              start: { x: margin.left, y },
              end: { x: margin.left + contentWidth, y },
              thickness: 1,
              color: rgb(0, 0, 0),
            });
          }

          // Draw vertical border lines
          for (let cIdx = 0; cIdx <= colsCount; cIdx += 1) {
            sheet.drawLine({
              start: { x: margin.left + cIdx * colWidth, y: tableTopY },
              end: { x: margin.left + cIdx * colWidth, y },
              thickness: 1,
              color: rgb(0, 0, 0),
            });
          }
        }
        y -= 12;
      } else write(block.text, { font: regular, size: baseSize, align: "justify" });
    }
  }

  stamp(sheet, currentLabel);

  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
}