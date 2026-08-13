import type { AnalysisResult } from "./document-model";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";
const MAX_CHARS = 400_000;

const SYSTEM_PROMPT = `You are the academic document understanding and validation engine behind AcadFormat.
You analyse a COMPLETE academic work as one document, never page by page.

Hard rules:
- Understand the whole work (topic, problem, objectives, methodology, results) BEFORE structural decisions.
- Never classify REFERENCES or APPENDICES as chapters, no matter how they are formatted.
- Do not treat a large heading as a chapter unless it is genuinely a chapter of the main body.
- Figure captions and table titles must be derived from the document's real content and context.
  Never invent results, statistics, values, references, or meanings.
- When a caption, title, or abbreviation meaning cannot be established confidently, set the text to
  "REQUIRES_USER_REVIEW" and lower the confidence.
- Embedded images appear in the text as [IMAGE:n] markers, in document order. Create ONE figure entry
  per [IMAGE:n] marker that belongs to the main body (skip logo images at the very start of the file),
  keeping them in the same order as the markers, and set originalLabel to the marker text.
- Abbreviations must be extracted from the actual text with their real expansions.
- Titles must be returned WITHOUT their numbering: chapter titles carry no "CHAPTER TWO"/"2." prefix
  and section titles carry no "2.1"/"2.1.1" prefix. AcadFormat renumbers everything itself, so any
  number you leave in a title becomes a visible duplicate ("2.1 2.1 Background").
- Never repeat a chapter or section heading inside another section's content. A heading line that the
  author typed at the end of a page belongs to the next chapter, not to the previous one's text.
- Table titles must be the real caption of the table, and the table's first row is its header row.
- ABSOLUTE RULE — NEVER SHORTEN THE WORK. You must not summarise, paraphrase, compress, truncate,
  or drop any sentence of the author's text. Every paragraph of the uploaded document must appear in
  exactly one section, word for word. You only restructure, label, and renumber.
- For every section you output, also return "startMarker" (the first 8-12 words of that section,
  copied verbatim from the document) and "endMarker" (its last 8-12 words, verbatim). These markers
  are used to re-attach the author's full original text, so they must be exact copies.
- If a section is very long, still return its full content; if you truly cannot repeat it all,
  return correct startMarker/endMarker so nothing is lost.

Return STRICT JSON only, matching this shape:
{
 "understanding": {"topic":"","problem":"","objectives":[],"researchQuestions":[],"methodology":"","technologies":[],"findings":[],"conclusions":"","terminology":[]},
 "model": {
   "meta": {"title":"","author":"","registrationNumber":"","department":"","supervisors":[],"monthYear":"","keywords":[]},
   "preliminary": [{"type":"ABSTRACT","title":"Abstract","content":"","present":true}],
   "chapters": [{"number":1,"title":"","type":"INTRODUCTION","intro":"","sections":[{"title":"","content":"","startMarker":"","endMarker":""}],
                 "figures":[{"id":"f1","chapter":1,"caption":"","originalLabel":"","kind":"","requiresUserReview":false,"confidence":90}],
                 "tables":[{"id":"t1","chapter":1,"title":"","originalLabel":"","requiresUserReview":false,"confidence":90}]}],
   "references": [],
   "appendices": [{"label":"Appendix A","title":"","content":""}],
   "abbreviations": [{"abbreviation":"","meaning":"","firstOccurrence":"","definedInText":true,"requiresUserReview":false,"confidence":90}]
 },
 "health": {"structure":0,"formatting":0,"figures":0,"tables":0,"abbreviations":0,"references":0,"crossReferences":0,"summary":""},
 "issues": [{"category":"STRUCTURE|FIGURE|TABLE|ABBREVIATION|CROSS_REFERENCE|REFERENCE|NUMBERING|PRELIMINARY",
             "location":"","problem":"","explanation":"","suggestion":"","confidence":0,"severity":"low|medium|high"}]
}
health.figures/tables/abbreviations/references/crossReferences are COUNTS of issues (abbreviations = count detected).
structure and formatting are percentage scores 0-100. Section content must remain complete and verbatim.`;

export async function analyzeWithAI(input: {
  text: string;
  fileName: string;
  imageCount: number;
  tableCount: number;
  institutionHint: string;
}): Promise<AnalysisResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `File: ${input.fileName}
Detected embedded images: ${input.imageCount}
Detected tables: ${input.tableCount}
Target institutional format: ${input.institutionHint}

FULL DOCUMENT TEXT:
${input.text.slice(0, MAX_CHARS)}`,
      },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });

  if (response.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
  if (response.status === 402)
    throw new Error("AI credits exhausted. Add credits in your workspace to continue.");
  if (!response.ok) throw new Error(`AI analysis failed (${response.status}): ${await response.text()}`);

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const jsonText = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(jsonText) as AnalysisResult;
  } catch {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("The AI returned an unreadable analysis. Try again.");
    parsed = JSON.parse(jsonText.slice(start, end + 1)) as AnalysisResult;
  }

  return normalize(parsed);
}

function normalize(result: AnalysisResult): AnalysisResult {
  const model = result.model || ({} as AnalysisResult["model"]);
  const bannedAsChapter = /^(references?|bibliograph|appendi|curriculum)/i;
  const chapters = (model.chapters || [])
    .filter((chapter) => !bannedAsChapter.test(chapter.title || ""))
    .map((chapter, index) => ({
      ...chapter,
      number: index + 1,
      sections: chapter.sections || [],
      figures: (chapter.figures || []).map((figure, i) => ({
        ...figure,
        id: figure.id || `c${index + 1}f${i + 1}`,
        chapter: index + 1,
        caption: figure.caption?.trim() || "REQUIRES_USER_REVIEW",
      })),
      tables: (chapter.tables || []).map((table, i) => ({
        ...table,
        id: table.id || `c${index + 1}t${i + 1}`,
        chapter: index + 1,
        title: table.title?.trim() || "REQUIRES_USER_REVIEW",
      })),
    }));

  return {
    understanding: result.understanding,
    health: result.health,
    issues: (result.issues || []).map((issue) => ({
      ...issue,
      confidence: Math.max(0, Math.min(100, Math.round(issue.confidence ?? 50))),
      severity: ["low", "medium", "high"].includes(issue.severity) ? issue.severity : "medium",
    })),
    model: {
      meta: model.meta || { title: "Untitled work", author: "" },
      preliminary: model.preliminary || [],
      chapters,
      references: model.references || [],
      appendices: model.appendices || [],
      abbreviations: model.abbreviations || [],
    },
  };
}