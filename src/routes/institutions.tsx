import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  COLTECH_CONFIG,
  COMMON_CONFIG,
  INTERNSHIP_CONFIG,
  COLTECH_INTERNSHIP_CONFIG,
  ASSIGNMENT_CONFIG,
  UNIVERSITIES,
  DEGREE_PROGRAMS,
} from "@/lib/institutions";
import { GraduationCap, BookOpen, CheckCircle, FileText, Building2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/institutions")({
  head: () => ({
    meta: [
      { title: "Institutional Standards & Guidelines — AcadFormat" },
      {
        name: "description",
        content:
          "Explore verified academic formatting rules for the University of Bamenda, COLTECH, FEMS, NAHPI, HTTTC, and general thesis standards.",
      },
      { property: "og:title", content: "AcadFormat Institutional Standards" },
      {
        property: "og:description",
        content:
          "Official formatting specifications for dissertations, theses, internship reports, and course assignments.",
      },
    ],
  }),
  component: InstitutionsPage,
});

const CONFIG_LIST = [
  COLTECH_CONFIG,
  COLTECH_INTERNSHIP_CONFIG,
  COMMON_CONFIG,
  INTERNSHIP_CONFIG,
  ASSIGNMENT_CONFIG,
];

function InstitutionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(COLTECH_CONFIG.id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const activeConfig = CONFIG_LIST.find((c) => c.id === selectedConfigId) || COLTECH_CONFIG;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <GraduationCap className="h-3.5 w-3.5" /> Institutional Specs
          </span>
          <h1 className="mt-4 font-display text-4xl font-normal tracking-tight sm:text-5xl">
            Verified Formatting Standards
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            AcadFormat strictly enforces layout rules directly sourced from university handbooks, guidelines, and official Senate regulations.
          </p>
        </div>

        {/* Institution Selector Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIG_LIST.map((config) => (
            <button
              key={config.id}
              onClick={() => setSelectedConfigId(config.id)}
              className={`rounded-xl border p-5 text-left transition-all ${
                selectedConfigId === config.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {config.citationStyle} • {config.font} {config.fontSizePt}pt
                </span>
                {selectedConfigId === config.id && (
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              <h3 className="mt-2 font-display text-lg">{config.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{config.source}</p>
            </button>
          ))}
        </div>

        {/* Standards Showcase Graphic Banner */}
        <div className="mt-10 rounded-2xl border border-border bg-slate-950 p-3 sm:p-5 shadow-xl">
          <img
            src="/standards-showcase.png"
            alt="University Thesis Formatting Standards and Specification Guidelines"
            className="w-full h-auto rounded-xl object-cover max-h-[460px]"
          />
        </div>

        {/* Active Configuration Details */}
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Config ID: {activeConfig.id}
              </span>
              <h2 className="mt-2 font-display text-3xl">{activeConfig.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{activeConfig.source}</p>
            </div>
            <Button asChild>
              <Link to={user ? "/dashboard" : "/auth"}>
                Format a Document with this Config
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {/* Left Column: Rules & Specs */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Page & Typography Rules
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Typeface & Size</span>
                    <p className="font-medium mt-0.5">{activeConfig.font} {activeConfig.fontSizePt}pt</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Line Spacing</span>
                    <p className="font-medium mt-0.5">{activeConfig.lineSpacing} Lines</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Margins</span>
                    <p className="font-medium mt-0.5">
                      Left: {activeConfig.marginsIn.left}", Top/Right/Bot: {activeConfig.marginsIn.top}"
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Citation Style</span>
                    <p className="font-medium mt-0.5">{activeConfig.citationStyle}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Figure Captions</span>
                    <p className="font-medium mt-0.5">
                      {activeConfig.figureCaptionPosition.toUpperCase()} figure ({activeConfig.figureNumbering} numbering)
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-muted-foreground">Table Titles</span>
                    <p className="font-medium mt-0.5">
                      {activeConfig.tableCaptionPosition.toUpperCase()} table ({activeConfig.tableNumbering} numbering)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Key Formatting Rules & Evidence
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {activeConfig.notes.map((note, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column: Preliminary & Body Structure */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Preliminary Section Order
                </h3>
                <ol className="mt-3 divide-y divide-border/60 rounded-lg border border-border bg-secondary/20 text-xs font-mono">
                  {activeConfig.preliminaryOrder.map((section, idx) => (
                    <li key={section} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">{String(idx + 1).padStart(2, "0")}.</span>
                      <span className="font-medium text-foreground">{section.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {idx === 0 ? "No Number" : "Roman Lower"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">Standard Body Chapter Outline</h3>
                <ul className="mt-3 space-y-1.5 rounded-lg border border-border bg-secondary/20 p-3 text-xs">
                  {activeConfig.bodyOutline.map((chap, idx) => (
                    <li key={chap} className="flex items-center gap-2">
                      <span className="font-semibold text-primary font-mono">Chapter {idx + 1}:</span>
                      <span>{chap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Universities Section */}
        <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h2 className="font-display text-2xl">Supported Schools & Faculties</h2>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {UNIVERSITIES[0].schools.map((school) => (
              <div key={school.name} className="rounded-lg border border-border/80 bg-secondary/20 p-4">
                <h3 className="font-semibold text-sm text-foreground">{school.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  Default Config: {school.configId}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {school.departments.map((dept) => (
                    <span
                      key={dept}
                      className="rounded bg-background px-2 py-0.5 text-[11px] border border-border/60 text-muted-foreground"
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        AcadFormat — Verified academic formatting rules and document engine.
      </footer>
    </div>
  );
}
