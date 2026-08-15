import type { AnalysisResult, DocumentModel } from "./document-model";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_CHARS = 160_000;

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
   "meta": {"title":"","author":"","registrationNumber":"","department":"","supervisors":[],"monthYear":"","keywords":[],"headOfDepartment":"","director":"","degreeOfAuthor":""},
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

export type AIProvider = "gemini" | "groq" | "openrouter" | "lovable" | "deepseek" | "custom";

interface ProviderConfig {
  provider: AIProvider;
  url: string;
  headers: Record<string, string>;
  model: string;
}

function resolveAIProvider(provider: AIProvider): ProviderConfig {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const groqKey = process.env["GROQ_API_KEY"];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const deepseekKey = process.env["DEEPSEEK_API_KEY"];
  const customKey = process.env["CUSTOM_API_KEY"];
  const customUrl = process.env["CUSTOM_API_URL"];

  switch (provider) {
    case "groq":
      return {
        provider: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        model: process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile",
      };
    case "gemini":
      return {
        provider: "gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${geminiKey}`,
        },
        model: process.env["GEMINI_MODEL"] || "gemini-2.5-flash",
      };
    case "openrouter":
      return {
        provider: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://acadformat.com",
          "X-Title": "AcadFormat",
        },
        model: process.env["OPENROUTER_MODEL"] || "google/gemini-2.5-flash",
      };
    case "lovable":
      return {
        provider: "lovable",
        url: GATEWAY,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey || "",
        },
        model: MODEL,
      };
    case "deepseek":
      return {
        provider: "deepseek",
        url: "https://api.deepseek.com/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey}`,
        },
        model: process.env["DEEPSEEK_MODEL"] || "deepseek-chat",
      };
    case "custom":
      return {
        provider: "custom",
        url: customUrl || "http://localhost:11434/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "Authorization": `Bearer ${customKey}` } : {}),
        },
        model: process.env["CUSTOM_MODEL"] || "llama3",
      };
  }
}

function hasKey(p: AIProvider): boolean {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const groqKey = process.env["GROQ_API_KEY"];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const deepseekKey = process.env["DEEPSEEK_API_KEY"];
  const customUrl = process.env["CUSTOM_API_URL"];

  if (p === "groq") return !!groqKey;
  if (p === "gemini") return !!geminiKey;
  if (p === "openrouter") return !!openrouterKey;
  if (p === "lovable") return !!lovableKey;
  if (p === "deepseek") return !!deepseekKey;
  if (p === "custom") return !!customUrl;
  return false;
}

export async function analyzeWithAI(input: {
  text: string;
  fileName: string;
  imageCount: number;
  tableCount: number;
  institutionHint: string;
  preferredProvider?: string;
}): Promise<AnalysisResult> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const groqKey = process.env["GROQ_API_KEY"];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const deepseekKey = process.env["DEEPSEEK_API_KEY"];


  // Build the list of providers to try
  const providersToTry: AIProvider[] = [];

  // 1. If preferredProvider is explicitly requested and has a key, try it first
  if (input.preferredProvider && hasKey(input.preferredProvider as AIProvider)) {
    providersToTry.push(input.preferredProvider as AIProvider);
  }

  // 2. If AI_PROVIDER is set in env and has a key, try it next
  const envProvider = (process.env["AI_PROVIDER"] || "").toLowerCase() as AIProvider;
  if (envProvider && hasKey(envProvider) && !providersToTry.includes(envProvider)) {
    providersToTry.push(envProvider);
  }

  // 3. Fallback list in order of speed/preference (custom -> groq -> gemini -> deepseek -> openrouter -> lovable)
  const defaultOrder: AIProvider[] = ["custom", "groq", "gemini", "deepseek", "openrouter", "lovable"];
  for (const p of defaultOrder) {
    if (hasKey(p) && !providersToTry.includes(p)) {
      providersToTry.push(p);
    }
  }

  if (providersToTry.length === 0) {
    throw new Error("AI is not configured. Please set GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, CUSTOM_API_URL, or LOVABLE_API_KEY in your environment.");
  }

  // Proactively skip Groq for very large documents if we are in auto-select mode to avoid 413 token limits
  const isTooLargeForGroq = input.text.length > 25000;

  let lastError: Error | null = null;

  for (const provider of providersToTry) {
    if (provider === "groq" && isTooLargeForGroq && input.preferredProvider !== "groq") {
      console.log(`[AI] Skipping Groq for large document (${input.text.length} chars) to avoid 413 rate limit.`);
      continue;
    }

    try {
      const config = resolveAIProvider(provider);
      console.log(`[AI] Attempting analysis using ${provider} with model ${config.model}...`);

      const body = {
        model: config.model,
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

      const response = await fetch(config.url, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        throw new Error(`Rate limit reached for ${provider}.`);
      }
      if (response.status === 402) {
        throw new Error(`Credits exhausted for ${provider}.`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider} failed (${response.status}): ${errorText}`);
      }

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
        if (start < 0 || end < 0) throw new Error("The AI returned an unreadable analysis.");
        parsed = JSON.parse(jsonText.slice(start, end + 1)) as AnalysisResult;
      }

      console.log(`[AI] Analysis succeeded using ${provider}!`);
      return normalize(parsed);
    } catch (err: any) {
      console.warn(`[AI] Provider ${provider} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`All AI analysis attempts failed. Last error: ${lastError?.message || "Unknown error"}`);
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

const CHAT_EDIT_SYSTEM_PROMPT = `You are the academic document editing assistant.
You are given:
1. The current DocumentModel in JSON format (which represents the parsed structure of the document).
2. The user's editing instruction/chat message.
3. The selected text from the document (if any).

Your task is to modify the DocumentModel JSON object to apply the requested edit.
Make sure to follow these instructions:
- If the user wants to remove highlighted/selected content, search for that content in the DocumentModel (chapters, sections, prelims, etc.) and remove it or replace it.
- If the user wants to add/generate specific content in a particular place, construct the appropriate chapter or section, write the academic content (following standard academic structure and high quality), and insert/add it.
- You can add new chapters, delete chapters, update chapter titles or introductions.
- You can add new sections to a chapter, delete sections, or update section contents.
- You can edit the meta information (title, author, department, keywords).
- Do not lose other fields or structures in the DocumentModel JSON.
- If you can't find the exact selected text, do your best to locate and edit the closest match.
- Return a JSON object with two fields:
  1. "model": The modified DocumentModel JSON object.
  2. "message": A friendly, short textual response explaining the changes you made.

Your output must be strict, valid JSON with ONLY these two fields:
{
  "model": { ... },
  "message": "..."
}`;

export interface ChatEditInput {
  model: DocumentModel;
  message: string;
  selectedText?: string;
  preferredProvider?: AIProvider;
}

export interface ChatEditResult {
  model: DocumentModel;
  message: string;
}

export async function chatEditDocument(input: ChatEditInput): Promise<ChatEditResult> {
  const providersToTry: AIProvider[] = [];
  if (input.preferredProvider && hasKey(input.preferredProvider)) {
    providersToTry.push(input.preferredProvider);
  }
  const envProvider = process.env["AI_PROVIDER"] as AIProvider | undefined;
  if (envProvider && hasKey(envProvider) && !providersToTry.includes(envProvider)) {
    providersToTry.push(envProvider);
  }
  const defaultOrder: AIProvider[] = ["custom", "groq", "gemini", "deepseek", "openrouter", "lovable"];
  for (const p of defaultOrder) {
    if (hasKey(p) && !providersToTry.includes(p)) {
      providersToTry.push(p);
    }
  }

  if (providersToTry.length === 0) {
    throw new Error("AI is not configured. Please set GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, CUSTOM_API_URL, or LOVABLE_API_KEY in your environment.");
  }

  // Model input serialization (strip unneeded heavy properties)
  const aiModelInput = { ...input.model };
  delete aiModelInput.original;
  delete aiModelInput.images;
  const modelJson = JSON.stringify(aiModelInput);
  const isTooLargeForGroq = modelJson.length > 25000;

  let lastError: Error | null = null;

  for (const provider of providersToTry) {
    if (provider === "groq" && isTooLargeForGroq && input.preferredProvider !== "groq") {
      console.log(`[AI] Skipping Groq for large model size (${modelJson.length} chars) to avoid 413 rate limit.`);
      continue;
    }

    try {
      const config = resolveAIProvider(provider);
      console.log(`[AI-Chat] Attempting document edit using ${provider} with model ${config.model}...`);

      const body = {
        model: config.model,
        messages: [
          { role: "system", content: CHAT_EDIT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `CURRENT DOCUMENT MODEL JSON:
${modelJson}

USER MESSAGE/INSTRUCTION:
${input.message}

SELECTED/HIGHLIGHTED TEXT (IF ANY):
${input.selectedText || "(None)"}`,
          },
        ],
        response_format: { type: "json_object" },
      };

      const response = await fetch(config.url, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        throw new Error(`Rate limit reached for ${provider}.`);
      }
      if (response.status === 402) {
        throw new Error(`Credits exhausted for ${provider}.`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider} failed (${response.status}): ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const jsonText = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      
      let parsed: ChatEditResult;
      try {
        parsed = JSON.parse(jsonText) as ChatEditResult;
      } catch {
        const start = jsonText.indexOf("{");
        const end = jsonText.lastIndexOf("}");
        if (start < 0 || end < 0) throw new Error("The AI returned an unreadable edit response.");
        parsed = JSON.parse(jsonText.slice(start, end + 1)) as ChatEditResult;
      }

      // Re-normalize the modified model to keep numbering/IDs correct
      if (parsed.model) {
        if (input.model.original) {
          parsed.model.original = input.model.original;
        }
        if (input.model.images) {
          parsed.model.images = input.model.images;
        }
        
        const normalizedResult = normalize({
          model: parsed.model,
          understanding: {} as any,
          health: {} as any,
          issues: [],
        });
        parsed.model = normalizedResult.model;
      }

      console.log(`[AI-Chat] Document edit succeeded using ${provider}!`);
      return parsed;
    } catch (err: any) {
      console.warn(`[AI-Chat] Provider ${provider} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`All AI edit attempts failed. Last error: ${lastError?.message || "Unknown error"}`);
}