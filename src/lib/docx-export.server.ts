import {
  AlignmentType,
  Document,
  Footer,
  NumberFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
  SectionType,
} from "docx";
import type { FinalDocument, RenderedPage } from "./document-model";
import type { InstitutionConfig } from "./institutions";

const DXA_PER_INCH = 1440;

function renderPage(page: RenderedPage, config: InstitutionConfig, isLast: boolean): Paragraph[] {
  const font = config.font;
  const size = config.fontSizePt * 2;
  const spacing = { line: Math.round(config.lineSpacing * 240), after: 120 };
  const paragraphs: Paragraph[] = [];

  page.blocks.forEach((block) => {
    if (block.type === "spacer") {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "", font, size })] }));
      return;
    }
    const common = { font, size };
    switch (block.type) {
      case "title":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing,
            children: [new TextRun({ ...common, text: block.text, bold: true, size: 32 })],
          }),
        );
        break;
      case "center":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing,
            children: [new TextRun({ ...common, text: block.text, size: 28 })],
          }),
        );
        break;
      case "heading1":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { ...spacing, before: 240 },
            children: [new TextRun({ ...common, text: block.text, bold: true, size: size + 4 })],
          }),
        );
        break;
      case "heading2":
        paragraphs.push(
          new Paragraph({
            spacing: { ...spacing, before: 180 },
            children: [new TextRun({ ...common, text: block.text, bold: true })],
          }),
        );
        break;
      case "caption":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing,
            children: [new TextRun({ ...common, text: block.text, italics: true, size: size - 2 })],
          }),
        );
        break;
      case "listline": {
        const [left, right] = block.text.split("\t");
        paragraphs.push(
          new Paragraph({
            spacing: { line: 240, after: 60 },
            children: [
              new TextRun({ ...common, text: right ? `${left}  ${".".repeat(6)}  ${right}` : left ?? "" }),
            ],
          }),
        );
        break;
      }
      default:
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing,
            children: [new TextRun({ ...common, text: block.text })],
          }),
        );
    }
  });

  if (!isLast) paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  return paragraphs;
}

export async function buildDocx(final: FinalDocument, config: InstitutionConfig) {
  const margin = {
    top: Math.round(config.marginsIn.top * DXA_PER_INCH),
    bottom: Math.round(config.marginsIn.bottom * DXA_PER_INCH),
    left: Math.round(config.marginsIn.left * DXA_PER_INCH),
    right: Math.round(config.marginsIn.right * DXA_PER_INCH),
  };
  const page = { size: { width: 12240, height: 15840 }, margin };

  const prelim = final.pages.filter((p) => p.kind === "cover" || p.kind === "preliminary");
  const body = final.pages.filter((p) => p.kind === "body" || p.kind === "back");

  const footer = (format: (typeof NumberFormat)[keyof typeof NumberFormat]) =>
    new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ children: [PageNumber.CURRENT], font: config.font, size: config.fontSizePt * 2 }),
          ],
        }),
      ],
    });

  const document = new Document({
    styles: { default: { document: { run: { font: config.font, size: config.fontSizePt * 2 } } } },
    sections: [
      {
        properties: {
          page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
        },
        footers: { default: footer(NumberFormat.LOWER_ROMAN) },
        children: prelim.flatMap((p, i) => renderPage(p, config, i === prelim.length - 1)),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
        },
        footers: { default: footer(NumberFormat.DECIMAL) },
        children: body.flatMap((p, i) => renderPage(p, config, i === body.length - 1)),
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return Buffer.from(buffer).toString("base64");
}