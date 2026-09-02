import type { AnalysisResult, DocumentModel } from "./document-model";
import { isPreambleNoiseLine } from "./utils";
import { detectChatEditErasure } from "./integrity";
import { reassembleReferences } from "./references";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";
const MAX_CHARS = 200_000;

const SYSTEM_PROMPT = `You are AcadFormat AI Engine, an advanced Document Layout Architect, AST Reconstruction Engine, and Citation Specialist.
Your objective is to perform a complete, zero-defect structural reconstruction of the uploaded academic document. You must resolve every sentence fragmentation, table corruption, list inline collapsing, double-referencing, and layout void issue while maintaining 100% text content integrity.

ZERO-CONTENT-LOSS & TEXT INTEGRITY (SOURCE OF TRUTH):
- ABSOLUTE CONTENT PRESERVATION: The uploaded document text is the absolute source of truth. Do NOT rewrite, condense, paraphrase, or delete any sentences, arguments, citations, or metadata.
- NO SENTENCE FRAGMENTATION: Never inject artificial hard page breaks, newline characters, or line-slicing inside coherent sentences, citations, or references. Text nodes must remain continuous paragraphs that flow smoothly across page boundaries.
- PURGE AI ARTIFACTS: Strip unwanted markdown tokens (->, =>), stray characters, or raw error placeholders (REQUIRES_USER_REVIEW, undefined, null). Never output these strings.
- ABSOLUTE RULE ON PUNCTUATION: Never invent or insert punctuation not present in the source. Use exact characters from the source only.

WORK PLAN TABLE & DATA GRID RECONSTRUCTION:
- UNIFIED TABLE ELEMENTS: Reconstruct all tables (specifically Table 3.1: Proposed Work Plan and any other work plans, timelines, or evaluation matrices) as single, unified table grid elements.
- PRESERVE TABLE ROWS: Never sever table rows, timeline indicators (e.g., "Month 1", "Month 2", "Month 3", "Month 5", "Month 6", "Month 7", "Month 8"), or text cells into external body paragraphs or floating bordered boxes.
- CAPTION PLACEMENT: Place all table captions strictly ABOVE the table grid (e.g., "Table 3.1: Proposed Work Plan").
- CRITICAL: NEVER invent or fabricate tables not explicitly present in the source. If no tables exist, tables must be [].

INLINE LIST STRUCTURAL CONVERSION & HEADING LOGIC:
- INLINE ENUMERATION PARSING: Scan all body paragraphs for embedded run-in lists -- including Research Questions (RQ1, RQ2, RQ3), General and Specific Objectives, Scope points (i, ii, iii), and numbered items -- and convert them into cleanly indented, multi-line bulleted or numbered list items, each on its own line prefixed with its original marker.
- Keep list item markers EXACTLY as they appear: (i), (ii), 1., 2., RQ1:, RQ2:, I., II., III., etc.
- HEADING LEVEL CAP: Limit numbered section depth strictly to 3 levels (Chapter -> 1.1 -> 1.1.1). Convert any level-4 headings into bold unnumbered run-in subheadings.
- ENFORCE PARENT-CHILD SEQUENCING: Parent headings (e.g., 1.4 Rationale) must always precede sub-sections (e.g., 1.4.1 Justification). Eliminate orphaned or empty subheadings.
- Titles must be returned WITHOUT their numbering prefixes (AcadFormat renumbers automatically).
- Never repeat a chapter or section heading inside another section's content.

CHAPTER CLASSIFICATION RULES:
- ABSOLUTE RULE ON CHAPTER COUNT: Academic works have at most 5 main body chapters. NEVER create 6 or more chapters. REFERENCES, BIBLIOGRAPHY, EXECUTIVE SUMMARY, and APPENDICES must NEVER be returned as chapters.
- ABSOLUTE RULE ON CHAPTER 1: Contains only the academic introduction (Background, Problem Statement, Objectives, Research Questions, Rationale, Scope). NEVER include personal author details, cover page metadata, Declarations, Certifications, or Signature forms inside Chapter 1.
- ABSOLUTE RULE ON PRELIMINARY PAGES: Declarations, Certifications, Dedication, Acknowledgements, Abstract, Table of Contents, List of Figures, List of Tables, and List of Abbreviations belong strictly in "preliminary", NEVER inside Chapter 1.

PAGINATION, FLOW & WHITE SPACE ERADICATION:
- ELIMINATE BOTTOM-PAGE VOIDS: Remove artificial premature page breaks that leave 40%-85% of non-chapter pages blank. Standardize line spacing to 1.5 with 0 pt before/after to let text fill pages naturally.
- ORPHAN & WIDOW CONTROL: Bind every heading element directly to its following paragraph block (keep_with_next: true). Never leave isolated single lines or orphaned headings at page boundaries.
- INTENTIONAL BREAKS ONLY: Maintain hard page breaks strictly for major Chapter starts and the single References section.

UNIFIED SINGLE REFERENCES SECTION (APA 7TH):
- ABSOLUTE RULE ON REFERENCES: NEVER include bibliography text inside any chapter's content. References must ONLY be returned in the top-level "references" array.
- STRICTLY ONE REFERENCES SECTION: Consolidate all bibliographic entries into EXACTLY ONE References section. Purge duplicate headings, second reference pages, or repeated entries.
- One entry per array element -- each reference is a single string in APA 7th edition format.
- Apply alphabetical ordering. Split merged citations onto independent lines. Omit incomplete references. NEVER fabricate details.
- Deduplicate: if the same reference appears more than once, include it only once.

ABBREVIATIONS CLEANUP:
- Only include abbreviations whose meanings are explicitly stated in the source text with 100% certainty.
- If uncertain, OMIT it -- NEVER fabricate or guess definitions. NEVER output "undefined", "null", or placeholder strings.
- Embedded images appear as [IMAGE:n] markers. Create ONE figure entry per body marker (skip logos at document start), keeping original order.

OUTPUT EXECUTION:
- Return ONLY valid, raw, machine-readable JSON. Do NOT wrap in markdown code fences.
- Do NOT output conversational text, greetings, explanations, or summaries.
- For every section also return "startMarker" (first 8-12 verbatim words) and "endMarker" (last 8-12 verbatim words).
- If a section is very long, you MUST still return its full content EXACTLY as written. DO NOT paraphrase, truncate, or drop lines.

Return STRICT JSON only, matching this shape:
{
 "understanding": {"topic":"","problem":"","objectives":[],"researchQuestions":[],"methodology":"","technologies":[],"findings":[],"conclusions":"","terminology":[]},
 "model": {
   "meta": {"title":"","author":"","registrationNumber":"","department":"","supervisors":[],"monthYear":"","keywords":[],"headOfDepartment":"","director":"","degreeOfAuthor":""},
   "preliminary": [{"type":"ABSTRACT","title":"Abstract","content":"","present":true}],
   "chapters": [{"number":1,"title":"","type":"INTRODUCTION","intro":"","sections":[{"title":"","content":"","startMarker":"","endMarker":""}],
                 "figures":[],"tables":[]}],
   "references": [],
   "appendices": [],
   "abbreviations": [{"abbreviation":"","meaning":""}]
 },
 "health": {"structure":0,"formatting":0,"figures":0,"tables":0,"abbreviations":0,"references":0,"crossReferences":0,"summary":""},
 "issues": [{"category":"STRUCTURE|FIGURE|TABLE|ABBREVIATION|CROSS_REFERENCE|REFERENCE|NUMBERING|PRELIMINARY",
             "location":"","problem":"","explanation":"","suggestion":"","confidence":0,"severity":"low|medium|high"}]
}
health.figures/tables/abbreviations/references/crossReferences are COUNTS of issues (abbreviations = count detected).
structure and formatting are percentage scores 0-100. Section content must remain complete and verbatim.
CRITICAL: NEVER invent or create tables not explicitly present in the source text. If no tables exist, tables must be an empty array [].`;

export type AIProvider = "gemini" | "groq" | "openrouter" | "lovable" | "deepseek" | "custom";

interface ProviderConfig {
  provider: AIProvider;
  url: string;
  headers: Record<string, string>;
  model: string;
}

function resolveAIProvider(provider: AIProvider): ProviderConfig {
  const geminiKey = process.env["GEMINI_API_KEY"] || "";
  const groqKey = process.env["GROQ_API_KEY"] || "";
  const openrouterKey = process.env["OPENROUTER_API_KEY"] || "";
  const lovableKey = process.env["LOVABLE_API_KEY"] || "";
  const deepseekKey = process.env["DEEPSEEK_API_KEY"] || "";
  const customKey = process.env["CUSTOM_API_KEY"] || "";
  const customUrl = process.env["CUSTOM_API_URL"] || "";

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

  if (p === "groq") return !!groqKey && !groqKey.includes("your-");
  if (p === "gemini") return !!geminiKey && !geminiKey.includes("your-");
  if (p === "openrouter") return !!openrouterKey && !openrouterKey.includes("your-");
  if (p === "lovable") return !!lovableKey;
  if (p === "deepseek") return !!deepseekKey && !deepseekKey.includes("your-");
  if (p === "custom") return !!customUrl && !customUrl.includes("your-huggingface-space-or-cloudflare-worker");
  return false;
}

function extractJSONObject<T>(raw: string): T {
  let cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error("No JSON object found in AI response.");

    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = start; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      const jsonCandidate = cleaned.substring(start, end + 1);
      return JSON.parse(jsonCandidate) as T;
    }
    throw e;
  }
}

function fallbackRuleBasedAnalysis(input: {
  text: string;
  fileName: string;
  imageCount: number;
  tableCount: number;
  institutionHint: string;
}): AnalysisResult {
  console.log("[AI Failsafe] Executing deterministic structural document parser fallback...");
  let lines = input.text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Dynamic Title Extraction: find first prominent title line in first 30 lines
  let title = input.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").toUpperCase();
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const l = lines[i];
    if (
      l.length > 10 &&
      l.length < 150 &&
      !isPreambleNoiseLine(l) &&
      !/^table\s+of\s+contents/i.test(l) &&
      !/^list\s+of/i.test(l) &&
      !/^abstract/i.test(l) &&
      /^[A-Z0-9\s:,\-\.]{10,}$/.test(l)
    ) {
      title = l;
      break;
    }
  }

  // Dynamic Abstract Extraction
  let abstractContent = "";
  const absIdx = lines.findIndex((l) => /^abstract\b/i.test(l));
  if (absIdx >= 0) {
    const absLines: string[] = [];
    for (let i = absIdx + 1; i < Math.min(absIdx + 20, lines.length); i++) {
      if (/^(?:chapter|table|list|dedication|acknowledgement|introduction)/i.test(lines[i])) break;
      absLines.push(lines[i]);
    }
    abstractContent = absLines.join("\n\n").trim();
  }

  // Chapter Header Matching (matches "CHAPTER 1", "CHAPTER TWO", "1.0 INTRODUCTION", "2. LITERATURE REVIEW", etc.)
  const chapterHeaderRegex = /^(?:CHAPTER\s+(?:[IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b[:.\-–—]?\s*(.*)|(?:[1-5]\.0?\s+(?:INTRODUCTION|LITERATURE|METHODOLOGY|RESULTS|CONCLUSION|DISCUSSION)[^\n]*))/i;

  let currentChapterTitle = "";
  let currentChapterLines: string[] = [];
  const rawChapters: { title: string; type: string; lines: string[] }[] = [];

  for (const line of lines) {
    if (isPreambleNoiseLine(line)) continue;

    const match = line.match(chapterHeaderRegex);
    if (match) {
      if (currentChapterLines.length > 0 && currentChapterTitle) {
        rawChapters.push({
          title: currentChapterTitle,
          type: rawChapters.length === 0 ? "INTRODUCTION" : rawChapters.length === 1 ? "LITERATURE_REVIEW" : rawChapters.length === 2 ? "METHODOLOGY" : "RESULTS",
          lines: currentChapterLines,
        });
        currentChapterLines = [];
      }
      let cleaned = match[1]?.trim() || line;
      cleaned = cleaned.replace(/[\t\s]+\d+$/, "").replace(/^(?:CHAPTER\s*\d+[:.\-–—]?\s*)/i, "").trim();
      currentChapterTitle = cleaned || `CHAPTER ${rawChapters.length + 1}`;
    } else if (currentChapterTitle) {
      currentChapterLines.push(line);
    }
  }

  if (currentChapterLines.length > 0 && currentChapterTitle) {
    rawChapters.push({
      title: currentChapterTitle,
      type: rawChapters.length === 0 ? "INTRODUCTION" : rawChapters.length === 1 ? "LITERATURE_REVIEW" : rawChapters.length === 2 ? "METHODOLOGY" : "RESULTS",
      lines: currentChapterLines,
    });
  }

  // Fallback if no CHAPTER X headers found: split by lines
  if (rawChapters.length === 0) {
    rawChapters.push({
      title: "INTRODUCTION",
      type: "INTRODUCTION",
      lines: lines.filter((l) => !isPreambleNoiseLine(l)),
    });
  }

  // Parse dynamic sections inside each chapter
  const secRegex = /^(?:\d+\.\d+(?:\.\d+)?)\s+(.+)$/;

  const chapters = rawChapters.slice(0, 5).map((chap, idx) => {
    const chapNum = idx + 1;
    const secBlocks: { title: string; content: string; startMarker: string; endMarker: string }[] = [];

    let curSecTitle = chap.title || `Section ${chapNum}.1`;
    let curSecLines: string[] = [];

    for (const l of chap.lines) {
      const m = l.match(secRegex);
      if (m) {
        if (curSecLines.length > 0) {
          const content = curSecLines.join("\n").trim();
          if (content.length > 0) {
            secBlocks.push({
              title: curSecTitle,
              content,
              startMarker: curSecLines.slice(0, 2).join(" "),
              endMarker: curSecLines.slice(-2).join(" "),
            });
          }
          curSecLines = [];
        }
        curSecTitle = m[1]?.trim() || l;
      } else {
        curSecLines.push(l);
      }
    }

    if (curSecLines.length > 0) {
      const content = curSecLines.join("\n").trim();
      if (content.length > 0) {
        secBlocks.push({
          title: curSecTitle,
          content,
          startMarker: curSecLines.slice(0, 2).join(" "),
          endMarker: curSecLines.slice(-2).join(" "),
        });
      }
    }

    return {
      number: chapNum,
      title: chap.title || `Chapter ${chapNum}`,
      type: chap.type,
      intro: "",
      sections: secBlocks.length > 0 ? secBlocks : [
        {
          title: chap.title || `Section ${chapNum}.1`,
          content: chap.lines.join("\n").trim(),
          startMarker: chap.lines.slice(0, 2).join(" "),
          endMarker: chap.lines.slice(-2).join(" "),
        },
      ],
      figures: [],
      tables: [],
    };
  });

  return normalize({
    understanding: {
      topic: title,
      problem: "Standard academic analysis",
      objectives: ["Document formatting and structural preservation"],
      researchQuestions: [],
      methodology: "Document parsing engine",
      technologies: [],
      findings: [],
      conclusions: "",
      terminology: [],
    },
    model: {
      meta: {
        title,
        author: "",
        department: "",
        supervisors: [],
        monthYear: "",
        keywords: [],
      },
      preliminary: [{ type: "ABSTRACT", title: "Abstract", content: abstractContent, present: true }],
      chapters,
      references: [],
      appendices: [],
      abbreviations: [],
    },
    health: {
      structure: 90,
      formatting: 90,
      figures: input.imageCount,
      tables: input.tableCount,
      abbreviations: 0,
      references: 0,
      crossReferences: 0,
      summary: "Document parsed using failsafe structural engine.",
    },
    issues: [],
  });
}

export async function analyzeWithAI(input: {
  text: string;
  fileName: string;
  imageCount: number;
  tableCount: number;
  institutionHint: string;
  preferredProvider?: string;
}): Promise<AnalysisResult> {
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

  // 3. Fallback list in order of speed and reliability (gemini -> groq -> deepseek -> custom -> lovable -> openrouter)
  const defaultOrder: AIProvider[] = ["gemini", "groq", "deepseek", "custom", "lovable", "openrouter"];
  for (const p of defaultOrder) {
    if (hasKey(p) && !providersToTry.includes(p)) {
      providersToTry.push(p);
    }
  }

  let lastError: Error | null = null;

  for (const provider of providersToTry) {
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
        signal: AbortSignal.timeout(20_000),  // 90 s — large dissertations need time
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
      const parsed = extractJSONObject<AnalysisResult>(content);

      console.log(`[AI] Analysis succeeded using ${provider}!`);
      return normalize(parsed);
    } catch (err: any) {
      console.warn(`[AI] Provider ${provider} failed:`, err.message || err);
      lastError = err;
    }
  }

  console.warn(`[AI] All remote AI providers failed (${lastError?.message || "unknown"}). Falling back to failsafe deterministic parser.`);
  return fallbackRuleBasedAnalysis(input);
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
        // Never inject REQUIRES_USER_REVIEW — use blank fallback instead
        caption: (figure.caption?.trim() || "").replace(/\bREQUIRES_USER_REVIEW\b/g, "").trim(),
      })),
      tables: (chapter.tables || []).map((table, i) => ({
        ...table,
        id: table.id || `c${index + 1}t${i + 1}`,
        chapter: index + 1,
        title: (table.title?.trim() || "").replace(/\bREQUIRES_USER_REVIEW\b/g, "").trim(),
      })),
    }));

  return {
    understanding: result.understanding
      ? {
          ...result.understanding,
          objectives: Array.isArray(result.understanding.objectives)
            ? result.understanding.objectives
            : typeof result.understanding.objectives === "string"
              ? [result.understanding.objectives]
              : [],
          findings: Array.isArray(result.understanding.findings)
            ? result.understanding.findings
            : typeof result.understanding.findings === "string"
              ? [result.understanding.findings]
              : [],
          researchQuestions: Array.isArray(result.understanding.researchQuestions)
            ? result.understanding.researchQuestions
            : [],
          technologies: Array.isArray(result.understanding.technologies)
            ? result.understanding.technologies
            : [],
          terminology: Array.isArray(result.understanding.terminology)
            ? result.understanding.terminology
            : [],
        }
      : result.understanding,
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
      references: reassembleReferences(model.references || []),
      appendices: model.appendices || [],
      // Strip any undefined/null abbreviation entries the AI slipped through
      abbreviations: (model.abbreviations || [])
        .filter((a: any) => a && (a.abbreviation || a.term) && (a.meaning || a.definition))
        .map((a: any) => ({
          abbreviation: (a.abbreviation || a.term || "").replace(/\bREQUIRES_USER_REVIEW\b/g, "").trim(),
          meaning: (a.meaning || a.definition || "").replace(/\bREQUIRES_USER_REVIEW\b/g, "").trim(),
          firstOccurrence: a.firstOccurrence,
        }))
        .filter((a: any) => a.abbreviation && a.meaning),
      images: model.images || (result as any).model?.images || [],
      original: model.original || (result as any).model?.original || [],
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
- If the user asks to format, restore, or put text into a table, construct a valid Markdown table (using "| Col 1 | Col 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |"), insert it into the target section's content, and add an entry with title and id to that chapter's "tables" list.
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
  const defaultOrder: AIProvider[] = ["gemini", "groq", "deepseek", "custom", "lovable", "openrouter"];
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
        signal: AbortSignal.timeout(45000),
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
      const parsed = extractJSONObject<ChatEditResult>(content);

      // Re-normalize the modified model to keep numbering/IDs correct
      if (parsed.model) {
        // Preserve immutable fields that AI must never touch
        if (input.model.original) parsed.model.original = input.model.original;
        if (input.model.images)   parsed.model.images   = input.model.images;

        const normalizedResult = normalize({
          model: parsed.model,
          understanding: {} as any,
          health: {} as any,
          issues: [],
        });
        parsed.model = normalizedResult.model;

        // ── Chat-edit chapter erasure guard ──────────────────────────────
        // If the AI silently wiped ≥30 % of a chapter's words, roll that
        // chapter back to the original to prevent content loss.
        const erasures = detectChatEditErasure(input.model, parsed.model);
        if (erasures.length > 0) {
          console.warn(`[AI-Chat] Erasure guard triggered for ${erasures.length} chapter(s). Rolling back.`);
          erasures.forEach(({ chapter }) => {
            const origChap = input.model.chapters[chapter - 1];
            if (origChap) parsed.model.chapters[chapter - 1] = JSON.parse(JSON.stringify(origChap));
          });
        }
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