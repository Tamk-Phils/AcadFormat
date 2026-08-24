import type { DocumentModel } from "./document-model";
import { isPreambleNoiseLine } from "./utils";

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

  const normalize = (value: string) => (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const locate = (marker?: string, title?: string, contentSample?: string, from = 0) => {
    const searchTerms = [marker, title, contentSample].filter(Boolean);
    for (const rawTerm of searchTerms) {
      const needle = normalize(rawTerm || "");
      if (needle.length >= 8) {
        let at = normalized.indexOf(needle, from);
        if (at >= 0) return at;
        const shorter = needle.split(" ").slice(0, 4).join(" ");
        if (shorter.length >= 6) {
          at = normalized.indexOf(shorter, from);
          if (at >= 0) return at;
        }
      }
    }
    return -1;
  };

  type Anchor = { chapter: number; section: number; start: number };
  const anchors: Anchor[] = [];
  let cursor = 0;
  model.chapters.forEach((chapter, chapterIndex) => {
    chapter.sections.forEach((section, sectionIndex) => {
      const at = locate(section.startMarker, section.title, section.content?.slice(0, 90), cursor);
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
    let slice = sourceText.slice(from, to).trim();

    // Strip cover page / preamble noise lines from section content (especially for Chapter 1)
    const rawLines = slice.split("\n");
    const cleanLines = rawLines.filter((l) => !isPreambleNoiseLine(l));
    if (cleanLines.length > 0) {
      slice = cleanLines.join("\n").trim();
    }

    // Trim trailing header lines belonging to the next section/chapter
    if (i + 1 < anchors.length) {
      const nextAnchor = anchors[i + 1]!;
      const nextCh = next.chapters[nextAnchor.chapter];
      const nextTitles: string[] = [];
      let nextChapterNum: number | undefined;

      if (nextCh) {
        nextChapterNum = nextCh.number;
        if (nextCh.title) nextTitles.push(nextCh.title);
        const nextSec = nextCh.sections[nextAnchor.section];
        if (nextSec && nextSec.title) nextTitles.push(nextSec.title);
      }

      const lines = slice.split("\n");
      let trimCount = 0;
      for (let j = lines.length - 1; j >= 0; j -= 1) {
        const line = lines[j]!;
        const normLine = line.toLowerCase().replace(/[^a-z0-9]/g, "");

        const isEmpty = !normLine;
        const isPageNumber = /^\d+$/.test(normLine);
        const isChapterKeyword =
          nextChapterNum !== undefined &&
          (normLine === `chapter${nextChapterNum}` || normLine === `chapter`);
        let matchesNextTitle = false;
        for (const title of nextTitles) {
          const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normTitle && (normLine.includes(normTitle) || normTitle.includes(normLine))) {
            matchesNextTitle = true;
            break;
          }
        }

        if (isEmpty || isPageNumber || isChapterKeyword || matchesNextTitle) {
          trimCount += 1;
        } else {
          break; // Stop trimming when we hit actual content
        }
      }

      if (trimCount > 0) {
        slice = lines.slice(0, lines.length - trimCount).join("\n").trim();
      }
    }

    const section = next.chapters[anchor.chapter]?.sections[anchor.section];
    if (!section) return;
    // Only replace when the original text is richer than what the model returned.
    if (slice.length > (section.content || "").length) section.content = slice;
  });

  return next;
}