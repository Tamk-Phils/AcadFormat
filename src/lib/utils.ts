import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseTableRows(block: { tableRows?: string[][]; text?: string }): string[][] {
  let rows: string[][] = [];
  if (block.tableRows && block.tableRows.length > 0) {
    rows = block.tableRows.filter(
      (row) => row.length > 0 && !row.every((cell) => !cell.trim() || /^[:\-\s]+$/.test(cell.trim()))
    );
  } else if (typeof block.text === "string" && block.text) {
    const lines = block.text.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (/^table\s+\d+/i.test(trimmedLine) || /^tab\.\s*\d+/i.test(trimmedLine)) continue;

      let cells: string[] = [];
      if (trimmedLine.includes("  |  ")) {
        cells = trimmedLine.split("  |  ");
      } else if (trimmedLine.includes("|")) {
        cells = trimmedLine.split("|");
        if (trimmedLine.startsWith("|")) cells.shift();
        if (trimmedLine.endsWith("|")) cells.pop();
      } else if (trimmedLine.includes("\t")) {
        cells = trimmedLine.split("\t");
      } else if (/\s{2,}/.test(trimmedLine)) {
        cells = trimmedLine.split(/\s{2,}/);
      } else {
        continue;
      }

      const trimmed = cells.map((c) => c.trim());
      const isSeparator = trimmed.every((c) => !c || /^[:\-\s]+$/.test(c));
      if (!isSeparator && trimmed.some((c) => c.length > 0)) {
        rows.push(trimmed);
      }
    }
  }

  if (rows.length === 0) return [];
  const maxCols = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push("");
    return copy;
  });
}

