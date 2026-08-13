/**
 * Verified institutional formatting configurations.
 *
 * COLTECH values come from "Format of Dissertations and Theses in COLTECH"
 * (University of Bamenda, College of Technology, April 2020).
 * The COMMON config is the shared project / internship-report format that
 * compatible schools inherit; only create an override with verified evidence.
 */

export type SectionType =
  | "COVER_PAGE"
  | "TITLE_PAGE"
  | "COPYRIGHT"
  | "DECLARATION"
  | "CERTIFICATION"
  | "ACCEPTANCE"
  | "ABSTRACT"
  | "RESUME"
  | "DEDICATION"
  | "ACKNOWLEDGEMENTS"
  | "TABLE_OF_CONTENTS"
  | "LIST_OF_TABLES"
  | "LIST_OF_FIGURES"
  | "LIST_OF_ABBREVIATIONS"
  | "CHAPTER"
  | "INTRODUCTION"
  | "LITERATURE_REVIEW"
  | "METHODOLOGY"
  | "MATERIALS_AND_METHODS"
  | "RESULTS"
  | "DISCUSSION"
  | "CONCLUSION"
  | "RECOMMENDATIONS"
  | "REFERENCES"
  | "APPENDICES"
  | "CURRICULUM_VITAE"
  | "OTHER_INSTITUTIONAL_SECTION";

export interface InstitutionConfig {
  id: string;
  label: string;
  source: string;
  font: string;
  fontSizePt: number;
  lineSpacing: number;
  marginsIn: { top: number; bottom: number; left: number; right: number };
  citationStyle: string;
  figureNumbering: "chapter" | "sequential";
  tableNumbering: "chapter" | "sequential";
  figureCaptionPosition: "above" | "below";
  tableCaptionPosition: "above" | "below";
  preliminaryNumbering: "roman-lower" | "none";
  bodyNumbering: "arabic";
  coverPageNumbered: boolean;
  /** Number of institutional logos on the cover page (COLTECH uses UB + COLTECH). */
  coverLogoCount: number;
  preliminaryOrder: SectionType[];
  bodyOutline: string[];
  backMatter: SectionType[];
  notes: string[];
}

export const COLTECH_CONFIG: InstitutionConfig = {
  id: "coltech-dissertation",
  label: "COLTECH — Dissertation / Thesis",
  source: "Format of Dissertations and Theses in COLTECH (UBa, April 2020)",
  font: "Times New Roman",
  fontSizePt: 12,
  lineSpacing: 1.5,
  marginsIn: { top: 1, bottom: 1, left: 1.25, right: 1 },
  citationStyle: "APA",
  figureNumbering: "chapter",
  tableNumbering: "chapter",
  figureCaptionPosition: "below",
  tableCaptionPosition: "above",
  preliminaryNumbering: "roman-lower",
  bodyNumbering: "arabic",
  coverPageNumbered: false,
  coverLogoCount: 2,
  preliminaryOrder: [
    "COVER_PAGE",
    "TITLE_PAGE",
    "COPYRIGHT",
    "DECLARATION",
    "CERTIFICATION",
    "ACCEPTANCE",
    "ABSTRACT",
    "RESUME",
    "DEDICATION",
    "ACKNOWLEDGEMENTS",
    "TABLE_OF_CONTENTS",
    "LIST_OF_TABLES",
    "LIST_OF_FIGURES",
    "LIST_OF_ABBREVIATIONS",
  ],
  bodyOutline: [
    "Introduction",
    "Literature Review",
    "Materials and Methods",
    "Results and Discussion",
    "Conclusion, Recommendation and Perspective",
  ],
  backMatter: ["REFERENCES", "APPENDICES", "CURRICULUM_VITAE"],
  notes: [
    "Table legends are placed above the table; figure legends below the figure.",
    "Every table and figure must be referred to at least once in the text.",
    "A chapter or sub-section may not start with a table or figure.",
    "APA referencing, alphabetical by author surname, hanging indent.",
    "Cover and title page elements in at least font size 14; author name in capitals.",
    "Body length: 60–80 pages (BSc), 80–150 pages (MSc).",
  ],
};

export const COMMON_CONFIG: InstitutionConfig = {
  ...COLTECH_CONFIG,
  id: "common-project-report",
  label: "Common Project / Internship Report format",
  source: "Shared faculty project & internship-report structure",
  lineSpacing: 1.5,
  marginsIn: { top: 1, bottom: 1, left: 1.25, right: 1 },
  preliminaryOrder: [
    "COVER_PAGE",
    "TITLE_PAGE",
    "DECLARATION",
    "CERTIFICATION",
    "DEDICATION",
    "ACKNOWLEDGEMENTS",
    "ABSTRACT",
    "TABLE_OF_CONTENTS",
    "LIST_OF_FIGURES",
    "LIST_OF_TABLES",
    "LIST_OF_ABBREVIATIONS",
  ],
  bodyOutline: [
    "Introduction",
    "Literature Review",
    "Methodology",
    "Results and Discussion",
    "Conclusion and Recommendations",
  ],
  backMatter: ["REFERENCES", "APPENDICES"],
  notes: [
    "Shared configuration inherited by compatible project and internship reports.",
  ],
};

export interface InstitutionSelection {
  university: string;
  school: string;
  department: string;
  documentType: string;
  level: string;
  configId: string;
}

export const ASSIGNMENT_CONFIG: InstitutionConfig = {
  ...COMMON_CONFIG,
  id: "assignment",
  label: "Assignment / Coursework format",
  source: "AcadFormat standard assignment layout",
  lineSpacing: 1.5,
  marginsIn: { top: 1, bottom: 1, left: 1, right: 1 },
  figureNumbering: "sequential",
  tableNumbering: "sequential",
  preliminaryNumbering: "none",
  coverPageNumbered: false,
  preliminaryOrder: ["COVER_PAGE", "TABLE_OF_CONTENTS"],
  bodyOutline: ["Introduction", "Body / Answers", "Conclusion"],
  backMatter: ["REFERENCES"],
  notes: [
    "Cover page carries the course code and title, assignment title, student name and matricule, lecturer and date.",
    "No declaration, certification, abstract or résumé — assignments keep only a cover page and an optional table of contents.",
    "Figures and tables are numbered sequentially (Figure 1, Table 1) rather than per chapter.",
    "Body pages are numbered in arabic numerals from the first content page.",
  ],
};

export const UNIVERSITIES = [
  {
    name: "The University of Bamenda",
    schools: [
      {
        name: "College of Technology (COLTECH)",
        configId: COLTECH_CONFIG.id,
        departments: [
          "Computer Engineering",
          "Electrical and Electronic Engineering",
          "Civil Engineering and Architecture",
          "Mechanical and Industrial Engineering",
          "Agricultural and Environmental Engineering",
          "Food Science and Technology",
          "Mathematics and Computer Science",
        ],
      },
      {
        name: "Faculty of Science",
        configId: COMMON_CONFIG.id,
        departments: ["Computer Science", "Physics", "Chemistry", "Biology"],
      },
      {
        name: "Higher Technical Teacher Training College (HTTTC)",
        configId: COMMON_CONFIG.id,
        departments: ["Computer Science", "Electrical Engineering", "Civil Engineering"],
      },
    ],
  },
  {
    name: "Other institution (common format)",
    schools: [
      {
        name: "Faculty / School / College",
        configId: COMMON_CONFIG.id,
        departments: ["Department"],
      },
    ],
  },
] as const;

export const DOCUMENT_TYPES = [
  "Dissertation",
  "Thesis",
  "End of Course Project",
  "Internship Report",
  "Assignment",
] as const;

export const ACADEMIC_LEVELS = ["Bachelor's (BSc)", "Master's (MSc)", "PhD"] as const;

export type DegreeTier = "undergraduate" | "masters" | "doctorate";

export interface DegreeProgram {
  name: string;
  tier: DegreeTier;
}

/** Undergraduate, master's and doctoral programmes offered across partner schools. */
export const DEGREE_PROGRAMS: DegreeProgram[] = [
  { name: "HND — Higher National Diploma", tier: "undergraduate" },
  { name: "BSc — Bachelor of Science", tier: "undergraduate" },
  { name: "BTech — Bachelor of Technology", tier: "undergraduate" },
  { name: "BEng — Bachelor of Engineering", tier: "undergraduate" },
  { name: "BA — Bachelor of Arts", tier: "undergraduate" },
  { name: "BEd — Bachelor of Education", tier: "undergraduate" },
  { name: "BBA — Bachelor of Business Administration", tier: "undergraduate" },
  { name: "LLB — Bachelor of Laws", tier: "undergraduate" },
  { name: "DIPES I / DIPET I", tier: "undergraduate" },
  { name: "MSc — Master of Science", tier: "masters" },
  { name: "MTech — Master of Technology", tier: "masters" },
  { name: "MEng — Master of Engineering", tier: "masters" },
  { name: "MA — Master of Arts", tier: "masters" },
  { name: "MBA — Master of Business Administration", tier: "masters" },
  { name: "MEd — Master of Education", tier: "masters" },
  { name: "MPhil — Master of Philosophy", tier: "masters" },
  { name: "LLM — Master of Laws", tier: "masters" },
  { name: "DIPES II / DIPET II", tier: "masters" },
  { name: "PhD — Doctor of Philosophy", tier: "doctorate" },
  { name: "DBA — Doctor of Business Administration", tier: "doctorate" },
];

export const ACADEMIC_LEVEL_NAMES = DEGREE_PROGRAMS.map((p) => p.name);

export function degreeTier(level: string): DegreeTier {
  const found = DEGREE_PROGRAMS.find((p) => p.name === level);
  if (found) return found.tier;
  if (/phd|doctor/i.test(level)) return "doctorate";
  if (/^m|master/i.test(level)) return "masters";
  return "undergraduate";
}

/**
 * Cover-page wording: undergraduate works are a Project, master's works a
 * Dissertation and doctoral works a Thesis — regardless of loose wording used
 * by the author. Internship reports and assignments keep their own name.
 */
export function workLabel(documentType: string, level: string): string {
  if (/internship/i.test(documentType)) return "Internship Report";
  if (/assignment/i.test(documentType)) return "Assignment";
  const tier = degreeTier(level);
  if (tier === "doctorate") return "Thesis";
  if (tier === "masters") return "Dissertation";
  return "Project";
}

export function getConfig(configId: string): InstitutionConfig {
  if (configId === ASSIGNMENT_CONFIG.id) return ASSIGNMENT_CONFIG;
  return configId === COLTECH_CONFIG.id ? COLTECH_CONFIG : COMMON_CONFIG;
}

/**
 * Assignments never follow the dissertation structure, so the document type
 * wins over the school configuration when it is set to "Assignment".
 */
export function resolveConfig(selection: {
  configId: string;
  documentType?: string;
}): InstitutionConfig {
  if (selection.documentType === "Assignment") return ASSIGNMENT_CONFIG;
  return getConfig(selection.configId);
}