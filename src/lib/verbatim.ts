import type { DocumentModel } from "./document-model";

/**
 * The AI is asked never to shorten the work, but models still drift on very long
 * documents. This re-attaches the author's original text by locating each
 * section's verbatim start marker in the uploaded text and slicing everything up
 * to the next section's start. Nothing is ever dropped or rewritten.
 */
export function restoreVerbatimContent(model: DocumentModel, sourceText: string): DocumentModel {
  if (!sourceText || sourceText.length < 200) return model;

  // Normalised copy with an index map back into the original text.
  const map: number[] = [];
  let normalized = "";
  let lastWasSpace = true;
  for (let i = 0; i < sourceText.length; i += 1) {
    const char = sourceText[i]!;
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      normalized += " ";
      map.push(i);
      lastWasSpace = true;
    } else {
      normalized += char.toLowerCase();
      map.push(i);
      lastWasSpace = false;
    }
  }

  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const locate = (marker?: string, from = 0) => {
    const needle = normalize(marker || "");
    if (needle.length < 12) return -1;
    let at = normalized.indexOf(needle, from);
    if (at < 0) {
      const shorter = needle.split(" ").slice(0, 6).join(" ");
      if (shorter.length < 12) return -1;
      at = normalized.indexOf(shorter, from);
    }
    return at;
  };

  type Anchor = { chapter: number; section: number; start: number };
  const anchors: Anchor[] = [];
  let cursor = 0;
  model.chapters.forEach((chapter, chapterIndex) => {
    chapter.sections.forEach((section, sectionIndex) => {
      const at = locate(section.startMarker || section.content.slice(0, 90), cursor);
      if (at >= 0) {
        anchors.push({ chapter: chapterIndex, section: sectionIndex, start: at });
        cursor = at + 1;
      }
    });
  });

  if (anchors.length === 0) return model;

  const next: DocumentModel = JSON.parse(JSON.stringify(model));
  anchors.forEach((anchor, i) => {
    const endNormalized = i + 1 < anchors.length ? anchors[i + 1]!.start : normalized.length;
    const from = map[anchor.start] ?? 0;
    const to = map[Math.min(endNormalized, map.length - 1)] ?? sourceText.length;
    const slice = sourceText.slice(from, to).trim();
    const section = next.chapters[anchor.chapter]?.sections[anchor.section];
    if (!section) return;
    // Only replace when the original text is richer than what the model returned.
    if (slice.length > (section.content || "").length) section.content = slice;
  });

  return next;
}