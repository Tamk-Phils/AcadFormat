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

export function isPreambleNoiseLine(line: string): boolean {
  const norm = line.trim().toLowerCase();
  if (!norm) return false;

  // Declarations & Certifications
  if (
    norm.includes("hereby declare the ownership") ||
    norm.includes("record of my own research effort") ||
    norm.includes("hasn't been presented before") ||
    norm.includes("all borrowed ideas have been duly acknowledged") ||
    norm.includes("this is to certify that this internship") ||
    norm.includes("done by ngoh janice ambu") ||
    norm.includes("higher institute of commerce and management") ||
    norm.includes("academic supervisor:") ||
    norm.includes("field supervisor:") ||
    norm.includes("head of department")
  ) {
    return true;
  }

  // Signature lines & date placeholders
  if (
    /^(?:signature|date)[:\s\.–—]*$/i.test(norm) ||
    /^(?:date|signature)\s*[\.\_\-]{3,}\s*(?:signature|date)\s*[\.\_\-]{3,}/i.test(norm) ||
    /^\w+\s+signature[\.\_\-\s]*$/i.test(norm)
  ) {
    return true;
  }

  // Orphan/duplicate table & figure placeholders
  if (
    /^figure\s+\d+\.\d+(?:\s*:\s*figure\s+\d+\.\d+)?$/i.test(norm) ||
    /^table\s+\d+\.\d+\s*:\s*date/i.test(norm) ||
    /^figure\s+\d+\.\d+$/i.test(norm)
  ) {
    return true;
  }

  if (
    /^(?:building capacities|department of|a dissertation proposal|a thesis proposal|an internship report|in partial fulfilment|in partial fulfillment|college of technology|university of bamenda|by:|supervisor:|degree of author|master of technology|m\.tech|b\.tech|ph\.d|august \d{4}|january|february|march|april|may|june|july|september|october|november|december)/i.test(norm)
  ) {
    return true;
  }

  if (
    /^(?:certification|declaration|dedication|acknowledgement|acknowledgments|table of contents|list of figures|list of tables|list of abbreviations|abstract)\b/i.test(norm) &&
    norm.length < 100
  ) {
    return true;
  }

  if (/^\[degree of author/i.test(norm) || /^\[title of proposal/i.test(norm) || /^\[author name/i.test(norm)) {
    return true;
  }

  if (
    norm.includes("a dissertation proposal submitted to the department") ||
    norm.includes("in partial fulfilment of the requirements") ||
    norm.includes("registration number uba")
  ) {
    return true;
  }

  return false;
}


