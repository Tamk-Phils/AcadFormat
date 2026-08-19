import {
  AlignmentType,
  ImageRun,
  Document,
  Footer,
  NumberFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  SectionType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { FinalDocument, RenderedPage } from "./document-model";
import type { InstitutionConfig } from "./institutions";
import { parseTableRows } from "./utils";

const DXA_PER_INCH = 1440;

export interface ImageAsset {
  data: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
}

function imageType(contentType: string): ImageAsset["type"] {
  if (/jpe?g/i.test(contentType)) return "jpg";
  if (/gif/i.test(contentType)) return "gif";
  if (/bmp/i.test(contentType)) return "bmp";
  return "png";
}

function renderPage(
  page: RenderedPage,
  config: InstitutionConfig,
  breakAfter: boolean,
  images: Map<string, ImageAsset>,
): (Paragraph | Table)[] {
  const font = config.font;
  const size = config.fontSizePt * 2;
  const spacing = { line: Math.round(config.lineSpacing * 240), after: 120 };
  const elements: (Paragraph | Table)[] = [];

  page.blocks.forEach((block) => {
    if (block.type === "spacer") {
      elements.push(new Paragraph({ children: [new TextRun({ text: "", font, size })] }));
      return;
    }
    const common = { font, size };
    switch (block.type) {
      case "logos": {
        const runs = (block.imageIds ?? [])
          .map((id) => images.get(id))
          .filter((asset): asset is ImageAsset => Boolean(asset))
          .map(
            (asset) =>
              new ImageRun({
                type: asset.type,
                data: asset.data,
                transformation: { width: 90, height: 90 },
                altText: { title: "Logo", description: "Institution logo", name: "logo" },
              }),
          );
        if (runs.length > 0) {
          const children: any[] = [];
          runs.forEach((run, index) => {
            if (index > 0) {
              children.push(new TextRun({ text: "        ", font }));
            }
            children.push(run);
          });
          elements.push(new Paragraph({ alignment: AlignmentType.CENTER, children }));
        }
        break;
      }
      case "bilingual": {
        const leftParagraphs = (block.left || []).map((line) => new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: line, font, size: size - 3, bold: true })]
        }));
        const rightParagraphs = (block.right || []).map((line) => new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: line, font, size: size - 3, bold: true })]
        }));

        const logoRuns = (block.imageIds ?? [])
          .map((id) => images.get(id))
          .filter((asset): asset is ImageAsset => Boolean(asset))
          .map(
            (asset) =>
              new ImageRun({
                type: asset.type,
                data: asset.data,
                transformation: { width: 60, height: 60 },
                altText: { title: "Logo", description: "Institution logo", name: "logo" },
              }),
          );
        const centerChildren: any[] = [];
        logoRuns.forEach((run, index) => {
          if (index > 0) centerChildren.push(new TextRun({ text: "  ", font }));
          centerChildren.push(run);
        });
        const centerParagraphs = [new Paragraph({ alignment: AlignmentType.CENTER, children: centerChildren })];

        elements.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "auto" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
            left: { style: BorderStyle.NONE, size: 0, color: "auto" },
            right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 35, type: WidthType.PERCENTAGE },
                  borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } },
                  children: leftParagraphs,
                }),
                new TableCell({
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } },
                  children: centerParagraphs,
                }),
                new TableCell({
                  width: { size: 35, type: WidthType.PERCENTAGE },
                  borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } },
                  children: rightParagraphs,
                }),
              ],
            }),
          ],
        }));
        elements.push(new Paragraph({ children: [new TextRun({ text: "", font, size })] }));
        break;
      }
      case "ubaHeader": {
        const ubaLogoAsset = images.get("logo-uba");
        const secondaryLogoId = block.imageIds?.find(id => id !== "logo-uba");
        const secondaryLogoAsset = secondaryLogoId ? images.get(secondaryLogoId) : undefined;

        const leftCellChildren: any[] = [];
        if (ubaLogoAsset) {
          leftCellChildren.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new ImageRun({
                  type: ubaLogoAsset.type,
                  data: ubaLogoAsset.data,
                  transformation: { width: 50, height: 50 },
                  altText: { title: "Logo", description: "Institution logo", name: "logo" },
                }),
              ],
            })
          );
        }

        const rightCellChildren: any[] = [];
        if (secondaryLogoAsset) {
          rightCellChildren.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new ImageRun({
                  type: secondaryLogoAsset.type,
                  data: secondaryLogoAsset.data,
                  transformation: { width: 50, height: 50 },
                  altText: { title: "Logo", description: "Institution logo", name: "logo" },
                }),
              ],
            })
          );
        }

        const centerCellChildren = (block.left || []).map((line, idx) => {
          const isBold = idx === 0 || idx === 2 || idx === 5 || idx === 8;
          const sz = idx === 5 ? size - 2 : (idx === 6 || idx === 7 || idx === 9) ? size - 4 : size - 3;
          return new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 10, after: 10, line: 200 },
            children: [
              new TextRun({
                text: line,
                font,
                bold: isBold,
                size: sz,
                italics: idx === 9,
              }),
            ],
          });
        });

        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    },
                    children: leftCellChildren,
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    },
                    children: centerCellChildren,
                  }),
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                    },
                    children: rightCellChildren,
                  }),
                ],
              }),
            ],
          })
        );
        elements.push(new Paragraph({ spacing: { before: 180, after: 180 }, children: [] }));
        break;
      }
      case "image": {
        const asset = block.imageId ? images.get(block.imageId) : undefined;
        if (asset) {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new ImageRun({
                  type: asset.type,
                  data: asset.data,
                  transformation: { width: 420, height: 280 },
                  altText: {
                    title: "Figure",
                    description: block.text || "Figure",
                    name: "figure",
                  },
                }),
              ],
            }),
          );
        } else {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 180, after: 180 },
              children: [
                new TextRun({
                  ...common,
                  text: `[ ${block.text || "Figure Illustration"} ]`,
                  italics: true,
                  bold: true,
                  size: size - 2,
                }),
              ],
            }),
          );
        }
        break;
      }
      case "title":
        if (block.borderBox) {
          elements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "2B6CB0" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "2B6CB0" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "2B6CB0" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "2B6CB0" },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 240, after: 240 },
                          children: [new TextRun({ ...common, text: block.text, bold: true, size: 32 })],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          );
        } else {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing,
              children: [new TextRun({ ...common, text: block.text, bold: true, size: 32 })],
            }),
          );
        }
        break;
      case "center": {
        const centerSize = block.size ? block.size * 2 : 28;
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing,
            children: [
              new TextRun({
                ...common,
                text: block.text,
                size: centerSize,
                italics: block.italic || false,
                bold: block.bold || false,
              }),
            ],
          }),
        );
        break;
      }
      case "heading1":
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            pageBreakBefore: elements.length > 0,
            spacing: { before: 240, after: 80, line: Math.round(config.lineSpacing * 240) },
            children: [new TextRun({ ...common, text: block.text, bold: true, size: size + 4 })],
          }),
        );
        break;
      case "heading2":
        elements.push(
          new Paragraph({
            spacing: { before: 180, after: 60, line: Math.round(config.lineSpacing * 240) },
            children: [new TextRun({ ...common, text: block.text, bold: true })],
          }),
        );
        break;
      case "caption":
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing,
            children: [new TextRun({ ...common, text: block.text, italics: true, size: size - 2 })],
          }),
        );
        break;
      case "listline": {
        const textStr = typeof block.text === "string" ? block.text : String(block.text ?? "");
        const [left, right] = textStr.split("\t");
        const indent = ((block.level ?? 1) - 1) * 360;
        const bold = block.bold === true || (block.level === 1);
        elements.push(
          new Paragraph({
            spacing: { line: 260, before: 20, after: 20 },
            ...(indent > 0 ? { indent: { left: indent } } : {}),
            ...(right
              ? {
                  tabStops: [
                    { type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: "dot" as const },
                  ],
                }
              : {}),
            children: [
              new TextRun({ ...common, text: left ?? "", bold }),
              ...(right ? [new TextRun({ ...common, text: `\t${right}`, bold })] : []),
            ],
          }),
        );
        break;
      }
      case "table": {
        const rawRows = parseTableRows(block);

        const rows = rawRows.map((row, rIdx) => {
          return new TableRow({
            children: row.map((cell) => {
              return new TableCell({
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        ...common,
                        text: cell,
                        bold: rIdx === 0,
                      }),
                    ],
                  }),
                ],
              });
            }),
          });
        });

        if (rows.length > 0) {
          elements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              rows,
            }),
          );
        }
        break;
      }
      case "code": {
        const codeLines = (block.text || "").split("\n");
        codeLines.forEach((codeLine) => {
          elements.push(
            new Paragraph({
              spacing: { before: 30, after: 30, line: 240 },
              indent: { left: 360 },
              children: [
                new TextRun({
                  font: "Courier New",
                  size: size - 4,
                  text: codeLine || " ",
                }),
              ],
            })
          );
        });
        break;
      }
      case "bullet": {
        const cleanText = (block.text || "").replace(/^\s*[-*•+➢➤✓✔▪▫♦○●■▲▼◦]\s*/, "").trim();
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            indent: { left: 480 },
            spacing: { before: 40, after: 40, line: Math.round(config.lineSpacing * 240) },
            children: [new TextRun({ ...common, text: cleanText || block.text })],
          })
        );
        break;
      }
      default: {
        const isBulletLine = /^\s*[-*•+➢➤✓✔▪▫♦○●■▲▼◦]\s+/.test(block.text || "");
        if (isBulletLine) {
          const cleanText = (block.text || "").replace(/^\s*[-*•+➢➤✓✔▪▫♦○●■▲▼◦]\s*/, "").trim();
          elements.push(
            new Paragraph({
              bullet: { level: 0 },
              indent: { left: 480 },
              spacing: { before: 40, after: 40, line: Math.round(config.lineSpacing * 240) },
              children: [new TextRun({ ...common, text: cleanText })],
            })
          );
        } else {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing,
              children: [new TextRun({ ...common, text: block.text })],
            })
          );
        }
      }
    }
  });

  if (breakAfter) elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

export async function buildDocx(
  final: FinalDocument,
  config: InstitutionConfig,
  images: Map<string, ImageAsset> = new Map(),
) {
  const margin = {
    top: Math.round(config.marginsIn.top * DXA_PER_INCH),
    bottom: Math.round(config.marginsIn.bottom * DXA_PER_INCH),
    left: Math.round(config.marginsIn.left * DXA_PER_INCH),
    right: Math.round(config.marginsIn.right * DXA_PER_INCH),
  };
  const page = { size: { width: 12240, height: 15840 }, margin };

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

  const groups: {
    kind: "cover" | "preliminary" | "body" | "back";
    isNumbered: boolean;
    hasPageBorder: boolean;
    pages: RenderedPage[];
  }[] = [];

  final.pages.forEach((p) => {
    const isNumbered = Boolean(p.numberLabel);
    const hasPageBorder = Boolean(p.hasPageBorder);
    
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.kind === p.kind &&
      lastGroup.isNumbered === isNumbered &&
      lastGroup.hasPageBorder === hasPageBorder
    ) {
      lastGroup.pages.push(p);
    } else {
      groups.push({
        kind: p.kind,
        isNumbered,
        hasPageBorder,
        pages: [p],
      });
    }
  });

  const firstNumberedIndex = final.pages.findIndex((p) => Boolean(p.numberLabel));
  let hasSetFirstNumberedStart = false;

  const sections: any[] = groups.map((group, groupIdx) => {
    const isNumbered = group.isNumbered;
    const formatType =
      group.kind === "body" || group.kind === "back"
        ? NumberFormat.DECIMAL
        : NumberFormat.LOWER_ROMAN;

    const pageProps: any = {
      ...page,
    };

    if (group.hasPageBorder) {
      pageProps.borders = {
        pageBorderTop: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
        pageBorderBottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
        pageBorderLeft: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
        pageBorderRight: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
      };
    }

    if (isNumbered) {
      if (formatType === NumberFormat.DECIMAL && group.kind === "body" && groupIdx === groups.findIndex(g => g.kind === "body")) {
        // Reset body to start at 1
        pageProps.pageNumbers = { start: 1, formatType };
      } else if (!hasSetFirstNumberedStart && firstNumberedIndex >= 0) {
        // First numbered prelim section starts at its physical page index + 1
        pageProps.pageNumbers = { start: firstNumberedIndex + 1, formatType };
        hasSetFirstNumberedStart = true;
      } else {
        // Continue from previous section
        pageProps.pageNumbers = { formatType };
      }
    }

    const sectionOptions: any = {
      properties: {
        page: pageProps,
        type: groupIdx > 0 ? SectionType.NEXT_PAGE : undefined,
      },
      children: group.pages.flatMap((p, i) => {
        const isLastInGroup = i === group.pages.length - 1;
        return renderPage(p, config, !isLastInGroup, images);
      }),
    };

    if (isNumbered) {
      sectionOptions.footers = { default: footer(formatType) };
    }

    return sectionOptions;
  });

  const document = new Document({
    styles: { default: { document: { run: { font: config.font, size: config.fontSizePt * 2 } } } },
    sections,
  });

  const buffer = await Packer.toBuffer(document);
  return Buffer.from(buffer).toString("base64");
}