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
      if (/^Device\s*\(Hostname\)\s+Interface\s+IP\s+Address/i.test(trimmedLine)) {
        cells = ["Device (Hostname)", "Interface", "IP Address", "Subnet Mask", "Default Gateway"];
      } else if (/^(S\d+|PC\d+)\s+(VLAN\s+\d+|NIC)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(N\/A|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.test(trimmedLine)) {
        const m = trimmedLine.match(/^(S\d+|PC\d+)\s+(VLAN\s+\d+|NIC)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(N\/A|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)!;
        cells = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!];
      } else if (/^Ports\s+Assignment\s+Network$/i.test(trimmedLine)) {
        cells = ["Ports", "Assignment", "Network"];
      } else if (/^(Fa\d+\/\d+(?:\s*[–\-—]\s*0\/\d+)?)\s+(.*?)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*\/\d+)$/i.test(trimmedLine)) {
        const m = trimmedLine.match(/^(Fa\d+\/\d+(?:\s*[–\-—]\s*0\/\d+)?)\s+(.*?)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*\/\d+)$/i)!;
        cells = [m[1]!, m[2]!, m[3]!];
      } else if (trimmedLine.includes("  |  ")) {
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

