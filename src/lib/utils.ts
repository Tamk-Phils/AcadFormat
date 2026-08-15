import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseTableRows(block: { tableRows?: string[][]; text?: string }): string[][] {
  if (block.tableRows && block.tableRows.length > 0) {
    return block.tableRows.filter(
      (row) => row.length > 0 && !row.every((cell) => !cell.trim() || /^[:\-\s]+$/.test(cell.trim()))
    );
  }
  if (!block.text) return [];

  const lines = block.text.split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    let cells: string[] = [];
    if (line.includes("  |  ")) {
      cells = line.split("  |  ");
    } else if (line.includes("|")) {
      cells = line.split("|");
      if (line.trim().startsWith("|")) cells.shift();
      if (line.trim().endsWith("|")) cells.pop();
    } else if (line.includes("\t")) {
      cells = line.split("\t");
    } else if (/\s{3,}/.test(line)) {
      cells = line.split(/\s{3,}/);
    } else {
      continue;
    }

    const trimmed = cells.map((c) => c.trim());
    const isSeparator = trimmed.every((c) => !c || /^[:\-\s]+$/.test(c));
    if (!isSeparator && trimmed.some((c) => c.length > 0)) {
      rows.push(trimmed);
    }
  }

  return rows;
}

