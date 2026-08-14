import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Cpu,
  FileCheck,
  FileDown,
  GraduationCap,
  HelpCircle,
  Key,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation & User Guide — AcadFormat" },
      {
        name: "description",
        content:
          "Learn how to use AcadFormat, configure AI models (Gemini, Groq, OpenRouter), audit academic documents, and format dissertations to verified institutional standards.",
      },
      { property: "og:title", content: "AcadFormat Documentation & User Guide" },
      {
        property: "og:description",
        content:
          "Complete documentation on document parsing, multi-provider AI setup, verbatim text preservation, and exporting.",
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "getting-started" | "ai-config" | "verbatim" | "institutions" | "exporting" | "faq"
  >("getting-started");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        {/* Hero Banner */}
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-secondary/60 to-background p-8 sm:p-12 text-center shadow-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5" /> AcadFormat Documentation
          </span>
          <h1 className="mt-4 font-display text-4xl font-normal tracking-tight sm:text-5xl">
            How to Use AcadFormat
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Complete user guide, AI model configuration (Gemini, Groq, OpenRouter), structural audit pipeline, and institutional export rules.
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
            onClick={() => setActiveTab("ai-config")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "ai-config"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Cpu className="h-4 w-4" /> AI Models (Gemini/Groq/OpenRouter)
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
            <GraduationCap className="h-4 w-4" /> Institutional Standards
          </button>

          <button
            onClick={() => setActiveTab("exporting")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "exporting"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileDown className="h-4 w-4" /> Exporting (DOCX & PDF)
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
                  AcadFormat processes academic documents through a deterministic 6-step pipeline to ensure 100% text fidelity and exact institutional formatting.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">01</span>
                    <h3 className="mt-2 font-medium">Upload Document</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload your `.docx` or readable text `.pdf` dissertation, thesis, or project report on the Dashboard.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">02</span>
                    <h3 className="mt-2 font-medium">Structural Audit</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The AI model parses your entire work to understand topic, chapters, sections, figures, tables, and abbreviations.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">03</span>
                    <h3 className="mt-2 font-medium">Review & Decisions</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review structural health scorecards. Accept, reject, or edit flagged figure captions, table titles, or acronyms.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">04</span>
                    <h3 className="mt-2 font-medium">Select Institution</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose your target university standard (e.g. COLTECH University of Bamenda or General Thesis Format).
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">05</span>
                    <h3 className="mt-2 font-medium">Verbatim Rebuild</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat reorders sections, builds TOC/LOT/LOF/LOA, attaches original images, and applies exact styling.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-5">
                    <span className="font-display text-2xl text-accent font-semibold">06</span>
                    <h3 className="mt-2 font-medium">Preview & Export</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inspect the formatted layout on screen, then export your submission-ready Word `.docx` or `.pdf`.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button asChild size="lg">
                  <Link to={user ? "/dashboard" : "/auth"}>
                    {user ? "Go to My Dashboard" : "Get Started Now"}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: AI CONFIGURATION */}
          {activeTab === "ai-config" && (
            <div className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Key className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl">Configuring AI Providers</h2>
                    <p className="text-sm text-muted-foreground">
                      AcadFormat natively supports Google Gemini, Groq, OpenRouter, and Lovable AI models.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-primary">Flexible Multi-Provider API Architecture</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        You can specify your preferred AI provider in your environment file (`.env`). If `AI_PROVIDER` is set, AcadFormat routes requests to that specific API key. If unconfigured, it automatically detects any available key.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Env snippet */}
                <div className="mt-6">
                  <div className="flex items-center justify-between rounded-t-lg bg-secondary px-4 py-2 text-xs font-mono text-muted-foreground">
                    <span>.env configuration</span>
                    <button
                      onClick={() =>
                        copyCode(
                          `# Select AI Provider: "gemini" | "groq" | "openrouter" | "lovable"\nAI_PROVIDER="gemini"\n\n# API Keys\nGEMINI_API_KEY="your-gemini-api-key"\nGROQ_API_KEY="your-groq-api-key"\nOPENROUTER_API_KEY="your-openrouter-api-key"`,
                          "env-snippet"
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {copiedKey === "env-snippet" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-b-lg bg-black/90 p-4 text-xs font-mono text-zinc-100 leading-relaxed">
{`# Select AI Provider: "gemini" | "groq" | "openrouter" | "lovable"
AI_PROVIDER="gemini"

# Google Gemini API
GEMINI_API_KEY="your-gemini-api-key"
# GEMINI_MODEL="gemini-2.5-flash" (optional override)

# Groq API (ultra-fast inference)
GROQ_API_KEY="your-groq-api-key"
# GROQ_MODEL="llama-3.3-70b-versatile" (optional override)

# OpenRouter API (unified router)
OPENROUTER_API_KEY="your-openrouter-api-key"
# OPENROUTER_MODEL="google/gemini-2.5-flash" (optional override)`}
                  </pre>
                </div>

                {/* Provider Detailed Breakdown */}
                <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  <div className="rounded-xl border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500"></span> Google Gemini
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Default & recommended for large document parsing. Handles large context windows (up to 1M+ tokens) effortlessly.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <li>• Endpoint: `generativelanguage.googleapis.com`</li>
                      <li>• Default Model: `gemini-2.5-flash`</li>
                      <li>• Best for: Dissertation analysis & complex tables</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500"></span> Groq Cloud
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      High-speed LPU inference engine. Extremely fast structured JSON extraction for medium-sized papers.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <li>• Endpoint: `api.groq.com/openai/v1`</li>
                      <li>• Default Model: `llama-3.3-70b-versatile`</li>
                      <li>• Best for: Rapid structural scanning</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-border p-5 bg-secondary/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-500"></span> OpenRouter
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Unified gateway giving access to Claude 3.5, Llama 3.3, Gemini, and DeepSeek models with fallback routing.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <li>• Endpoint: `openrouter.ai/api/v1`</li>
                      <li>• Default Model: `google/gemini-2.5-flash`</li>
                      <li>• Best for: Multi-model flexibility</li>
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
                    Traditional AI assistants often attempt to summarize or rewrite text when reformatting academic papers. In dissertations and research reports, this causes critical loss of technical equations, citations, and data points.
                  </p>
                  <p>
                    <strong>AcadFormat solves this with Start & End Landmark Anchors:</strong>
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> 1. Verbatim Marker Re-Attacher
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      The AI model outputs structural metadata along with startMarker and endMarker phrases. AcadFormat locates these exact markers in the original source text and re-extracts the full text verbatim.
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> 2. Media Marker Mapping (`[IMAGE:n]`)
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Embedded images and figures are extracted at their exact locations in the document stream, uploaded safely to storage, and re-anchored into the formatted Word and PDF outputs.
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
                      Official Format
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
                  Download submission-ready Word `.docx` or PDF documents with 1-click.
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
                      Generated server-side with precise page bounds, clean typography, embedded vector graphics, and standard margins ready for printing or electronic submission.
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
                      AcadFormat accepts `.docx` files and searchable `.pdf` files. If your PDF is a scanned image, please convert or OCR it first before uploading.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-secondary/20">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> How do I switch AI providers?
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set `AI_PROVIDER="gemini"`, `"groq"`, or `"openrouter"` in your `.env` file along with the corresponding API key. Restart your server and AcadFormat will use the specified provider.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-secondary/20">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" /> What happens if a figure caption is missing?
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      AcadFormat flags missing figure captions or table titles as `REQUIRES_USER_REVIEW`. You can edit and supply the correct title directly on the Document Review panel.
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
