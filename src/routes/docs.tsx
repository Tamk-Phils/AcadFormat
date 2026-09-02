import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  FileCheck,
  FileDown,
  GraduationCap,
  HelpCircle,
  Layers,
  CheckCircle2,
  ListOrdered,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "User Guide & How to Use — AcadFormat" },
      {
        name: "description",
        content:
          "Learn how to format dissertations, project reports, and lab reports to verified institutional standards with 100% verbatim text preservation.",
      },
      { property: "og:title", content: "AcadFormat User Guide & Tutorial" },
      {
        property: "og:description",
        content:
          "Step-by-step guide to uploading documents, reviewing structural health scorecards, and exporting submission-ready Word and PDF files.",
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "getting-started" | "formatting-guide" | "verbatim" | "institutions" | "exporting" | "faq"
  >("getting-started");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-5 py-12">
        {/* Hero Banner */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-secondary/60 to-background p-8 sm:p-12 text-center shadow-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5" /> User Guide & Documentation
          </span>
          <h1 className="mt-4 font-display text-4xl font-normal tracking-tight sm:text-5xl">
            How to Use AcadFormat
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            A simple, step-by-step guide to uploading, auditing, restructuring, and exporting your academic work to verified institutional standards.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mt-10 flex flex-wrap gap-2 border-b border-border pb-4">
          <button
            onClick={() => setActiveTab("getting-started")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "getting-started"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" /> Quick Start
          </button>

          <button
            onClick={() => setActiveTab("formatting-guide")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "formatting-guide"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" /> Formatting Guidelines
          </button>

          <button
            onClick={() => setActiveTab("verbatim")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "verbatim"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileCheck className="h-4 w-4" /> Verbatim Preservation
          </button>

          <button
            onClick={() => setActiveTab("institutions")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "institutions"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Institutional Formats
          </button>

          <button
            onClick={() => setActiveTab("exporting")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "exporting"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileDown className="h-4 w-4" /> Exporting (Word & PDF)
          </button>

          <button
            onClick={() => setActiveTab("faq")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "faq"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <HelpCircle className="h-4 w-4" /> FAQ
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-8">
          {/* TAB 1: GETTING STARTED */}
          {activeTab === "getting-started" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="font-display text-2xl">Step-by-Step Workflow</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  AcadFormat processes academic documents through a 6-step pipeline designed to preserve 100% of your text while building a perfect institutional layout.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">01</span>
                    <h3 className="mt-2 font-medium">Upload Document</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload your Microsoft Word (`.docx`) or searchable PDF (`.pdf`) dissertation, lab report, or project report on your Dashboard.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">02</span>
                    <h3 className="mt-2 font-medium">Structural Audit</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat analyzes your document structure, identifying chapter headings, section hierarchy, figures, tables, and acronyms.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">03</span>
                    <h3 className="mt-2 font-medium">Review & Health Score</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inspect your document health score. Review and accept flagged suggestions for figure captions, table titles, or acronym definitions.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">04</span>
                    <h3 className="mt-2 font-medium">Select Target Institution</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select your target format rule (e.g. COLTECH University of Bamenda or General Academic Standard).
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">05</span>
                    <h3 className="mt-2 font-medium">Reconstruct Document</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat automatically builds preliminary pages (Cover Page, Title Page, Table of Contents, List of Figures/Tables), attaches extracted images, and numbers chapters.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">06</span>
                    <h3 className="mt-2 font-medium">Preview & Export</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review the rendered pages directly on screen, then export your submission-ready Word `.docx` or Adobe `.pdf` document.
                    </p>
                  </div>
                </div>

                {/* Documentation Visual Preview Banner */}
                <div className="mt-8 rounded-xl border border-border bg-slate-950 p-3 shadow-lg">
                  <img
                    src="/restructuring-showcase.png"
                    alt="AcadFormat Quick Start Dashboard Visual Guide"
                    className="w-full h-auto rounded-lg object-cover max-h-[420px]"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button asChild size="lg">
                  <Link to={user ? "/dashboard" : "/auth"}>
                    {user ? "Open My Dashboard" : "Get Started Now"}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: FORMATTING GUIDELINES */}
          {activeTab === "formatting-guide" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="font-display text-2xl">Document Formatting Guidelines</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Follow these simple tips to get the best formatting results from your uploaded files.
                </p>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <ListOrdered className="h-5 w-5 text-primary" /> Headings & Chapters
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li>• Use clear chapter titles like <strong className="text-foreground">CHAPTER 1: INTRODUCTION</strong> or <strong className="text-foreground">1.0 Introduction</strong>.</li>
                      <li>• Keep sub-sections numbered (e.g. 1.1 Background, 1.2 Problem Statement).</li>
                      <li>• AcadFormat automatically regenerates your Table of Contents with exact page numbers.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Zap className="h-5 w-5 text-accent" /> Figures & Topology Diagrams
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li>• Figures and diagrams are automatically extracted directly from your PDF or Word document.</li>
                      <li>• Caption your images (e.g., <em>Figure 1.1: Network Topology Diagram</em>).</li>
                      <li>• AcadFormat automatically creates a List of Figures in your preliminary pages.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" /> Tables & Data Grids
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li>• Ensure addressing tables or data grids have clear column headers (e.g., Device, Interface, IP Address).</li>
                      <li>• AcadFormat converts table rows into clean, structured grids for Word and PDF exports.</li>
                      <li>• Automatically builds a List of Tables with page number references.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-500" /> Abbreviations & Acronyms
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li>• Define acronyms upon first mention (e.g., <em>VLAN (Virtual Local Area Network)</em>).</li>
                      <li>• AcadFormat compiles all acronyms into an alphabetized List of Abbreviations automatically.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VERBATIM PRESERVATION */}
          {activeTab === "verbatim" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl">100% Verbatim Content Preservation</h2>
                    <p className="text-sm text-muted-foreground">
                      Why AcadFormat never summarizes, rewrites, or loses author text.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Traditional formatting software often rewrites or alters sentences, leading to loss of technical accuracy, mathematical equations, or specific citations.
                  </p>
                  <p>
                    <strong>AcadFormat uses a deterministic Landmark Extraction Engine:</strong>
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Exact Source Text Re-Anchoring
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Our engine anchors section headers to the exact starting and ending text blocks of your source document. The full original text is extracted verbatim without modifying a single word.
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Media & Image Anchoring
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Embedded images and figures are extracted as base64 images, preserved in your document model, and re-placed at their exact corresponding figure markers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INSTITUTIONAL STANDARDS */}
          {activeTab === "institutions" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="font-display text-2xl">Supported Institutional Formats</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  AcadFormat evaluates your document against specific institutional layout rules.
                </p>

                <div className="mt-6 space-y-6">
                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Official Verified Format
                    </span>
                    <h3 className="mt-2 font-display text-xl">
                      College of Technology (COLTECH) — University of Bamenda
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Strict format standard for B.Tech, M.Tech, and Internship reports at COLTECH.
                    </p>

                    <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded bg-background p-3 border border-border">
                        <strong>Preliminary Order:</strong> Title Page, Declaration, Certification, Dedication, Acknowledgements, Abstract, Table of Contents, List of Figures, List of Tables, List of Abbreviations.
                      </div>
                      <div className="rounded bg-background p-3 border border-border">
                        <strong>Chapter Layout:</strong> Chapter 1: Introduction, Chapter 2: Literature Review / System Study, Chapter 3: Methodology, Chapter 4: Results & Discussion, Chapter 5: Conclusion & Recommendations.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-5 bg-secondary/20">
                    <span className="rounded bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-foreground">
                      Standard Template
                    </span>
                    <h3 className="mt-2 font-display text-xl">General Academic Thesis Standard</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Universal academic layout for universities and institutions with standard 1-inch margins, Times New Roman 12pt, 1.5 line spacing, and Arabic chapter numbering.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-start">
                  <Button asChild variant="outline">
                    <Link to="/institutions">Explore Detailed Institution Specs</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXPORTING */}
          {activeTab === "exporting" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="font-display text-2xl">Exporting Your Formatted Work</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Download submission-ready Word `.docx` or PDF documents with 1 click.
                </p>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileDown className="h-5 w-5 text-blue-600" /> Microsoft Word (.docx) Export
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Generated using native OpenXML standards. Includes live Word Table of Contents, custom headers/footers, dynamic page numbering, embedded high-res figures, and editable tables.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-5">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileDown className="h-5 w-5 text-red-600" /> Adobe PDF (.pdf) Export
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Generated server-side with precise page bounds, clean typography, embedded graphics, and standard margins ready for printing or electronic submission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: FAQ */}
          {activeTab === "faq" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <h2 className="font-display text-2xl mb-6">Frequently Asked Questions</h2>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4 bg-secondary/20">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> What file formats can I upload?
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat accepts `.docx` files and searchable `.pdf` files.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-secondary/20">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> What happens if a figure caption is missing?
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat flags missing figure captions or table titles as requiring review. You can edit and supply the correct title directly on the Document Review panel.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-secondary/20">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> Are my uploaded documents kept private?
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Yes. Uploaded files are stored securely in Supabase storage with Row Level Security (RLS) policies restricted exclusively to your user account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        AcadFormat — Analysis, restructuring and formatting for academic work.
      </footer>
    </div>
  );
}
