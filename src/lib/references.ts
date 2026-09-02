/**
 * Reference Reassembly Engine
 * Restores fragmented reference lines (e.g. starting with leading dots, severed years,
 * or merged multi-author citations) into unified, audit-compliant APA reference strings.
 */
export function reassembleReferences(input: (string | null | undefined)[] | string): string[] {
  if (!input) return [];

  const items = Array.isArray(input) ? input : [input];
  const cleanedTokens: string[] = [];

  items.forEach((item) => {
    if (!item) return;
    const lines = String(item).split("\n");
    lines.forEach((line) => {
      let l = line.trim();
      if (!l) return;
      // Filter out heading titles
      if (/^(references?|bibliograph|works cited|list of references)$/i.test(l)) return;

      // Strip leading dots, bullets, dash artifacts, and AI noise
      l = l
        .replace(/^\.\s*/, "")
        .replace(/^[—–•*-]\s*/, "")
        .replace(/\bREQUIRES_USER_REVIEW\b/g, "")
        .trim();

      // Skip isolated digit page numbers (e.g. standalone "11")
      if (/^\d+$/.test(l)) return;

      if (l.length > 0) {
        cleanedTokens.push(l);
      }
    });
  });

  if (cleanedTokens.length === 0) return [];

  // Join all tokens with space and normalize whitespace
  const fullText = cleanedTokens.join(" ").replace(/\s+/g, " ").trim();

  // Regex splits before new reference entry boundaries:
  // 1. Bracketed numbers: [1], [2], etc. or numbered 1., 2.
  // 2. Author pattern (not preceded by & or , or 'and'): "Name, A." or "Name, A. B." followed by (YYYY)
  const pattern = /\s+(?=(?:\[\d+\]|\d+\.\s+[A-Z])|(?<![,&]\s)(?<!\band\s)(?:[A-Z][a-zA-Z\u00C0-\u024F'\-]+,\s+[A-Z][\.\s\w,&\-]*?\s*\((?:19|20)\d{2}\)))/g;

  const rawParts = fullText.split(pattern);
  const results: string[] = [];

  rawParts.forEach((part) => {
    let p = part.trim();
    if (p.length > 5 && p !== "undefined" && p !== "null") {
      // Fix spacing around punctuation: e.g. " (8), 4649" -> "(8), 4649"
      p = p.replace(/\s+([,.:;\)])/g, "$1");

      // Ensure leading dot artifact is stripped if any remains
      p = p.replace(/^\.\s*/, "").trim();

      if (p.length > 5) {
        results.push(p);
      }
    }
  });

  // Deduplicate case-insensitively while preserving original casing
  return results.filter(
    (ref, idx, arr) => arr.findIndex((x) => x.toLowerCase() === ref.toLowerCase()) === idx
  );
}
