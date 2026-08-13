import type { SectionType } from "./institutions";

export interface FigureItem {
  id: string;
  chapter: number;
  caption: string;
  originalLabel?: string;
  kind?: string;
  requiresUserReview?: boolean;
  confidence?: number;
}

export interface TableItem {
  id: string;
  chapter: number;
  title: string;
  originalLabel?: string;
  requiresUserReview?: boolean;
  confidence?: number;
}

export interface Abbreviation {
  abbreviation: string;
  meaning: string;
  firstOccurrence?: string;
  definedInText?: boolean;
  requiresUserReview?: boolean;
  confidence?: number;
}

export interface SubSection {
  number?: string;
  title: string;
  content: string;
  /** Verbatim first words of the section in the uploaded file (used to restore full text). */
  startMarker?: string;
  /** Verbatim last words of the section in the uploaded file. */
  endMarker?: string;
}

export interface Chapter {
  number: number;
  title: string;
  type: SectionType;
  intro?: string;
  sections: SubSection[];
  figures: FigureItem[];
  tables: TableItem[];
}

export interface PreliminaryItem {
  type: SectionType;
  title: string;
  content: string;
  present: boolean;
}

export interface DocumentMeta {
  title: string;
  author: string;
  registrationNumber?: string;
  department?: string;
  supervisors?: string[];
  monthYear?: string;
  keywords?: string[];
}

export interface DocumentModel {
  meta: DocumentMeta;
  preliminary: PreliminaryItem[];
  chapters: Chapter[];
  references: string[];
  appendices: { label: string; title: string; content: string }[];
  abbreviations: Abbreviation[];
  images?: DocumentImage[];
  /** Untouched rendering of the uploaded file (before any AI restructuring). */
  original?: OriginalBlock[];
}

export interface DocumentImage {
  id: string;
  path: string;
  contentType: string;
  role: "logo" | "figure";
}

/** Faithful, unmodified rendering of the uploaded file, used for the "original" preview. */
export interface OriginalBlock {
  type: "heading" | "para" | "image" | "table";
  text: string;
  level?: number;
  imageId?: string;
}

export interface Understanding {
  topic: string;
  problem: string;
  objectives: string[];
  researchQuestions: string[];
  methodology: string;
  technologies: string[];
  findings: string[];
  conclusions: string;
  terminology: string[];
}

export interface HealthReport {
  structure: number;
  formatting: number;
  figures: number;
  tables: number;
  abbreviations: number;
  references: number;
  crossReferences: number;
  summary: string;
}

export interface IssueDraft {
  category: string;
  location: string;
  problem: string;
  explanation: string;
  suggestion: string;
  confidence: number;
  severity: "low" | "medium" | "high";
}

export interface AnalysisResult {
  understanding: Understanding;
  model: DocumentModel;
  health: HealthReport;
  issues: IssueDraft[];
}

/* ---------- Rendered (final) document ---------- */

export type BlockType =
  | "title"
  | "heading1"
  | "heading2"
  | "para"
  | "center"
  | "caption"
  | "listline"
  | "image"
  | "logos"
  | "spacer";

export interface Block {
  type: BlockType;
  text: string;
  imageId?: string;
  imageIds?: string[];
  /** Indentation level for table-of-contents lines (1 = chapter, 2 = section). */
  level?: number;
  /** Renders the line in bold (chapter entries, table headers). */
  bold?: boolean;
}

export interface RenderedPage {
  index: number;
  numberLabel: string;
  kind: "cover" | "preliminary" | "body" | "back";
  sectionTitle: string;
  startsSection?: boolean;
  blocks: Block[];
}

export interface ListEntry {
  label: string;
  text: string;
  page: string;
}

export interface FinalDocument {
  pages: RenderedPage[];
  toc: (ListEntry & { level: number })[];
  listOfFigures: ListEntry[];
  listOfTables: ListEntry[];
  listOfAbbreviations: { label: string; text: string }[];
  images?: DocumentImage[];
  generatedAt: string;
}