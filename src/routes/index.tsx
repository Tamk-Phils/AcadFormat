import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AcadFormat — Academic Document Analysis & Formatting" },
      {
        name: "description",
        content:
          "Upload a dissertation or project report, get a full structural audit, then a rebuilt document formatted to your institution's verified standard.",
      },
      { property: "og:title", content: "AcadFormat — Academic Document Analysis & Formatting" },
      {
        property: "og:description",
        content:
          "Understand, audit, restructure and format your academic work, then preview and export it.",
      },
    ],
  }),
  component: Index,
});

const STEPS = [
  ["Understand", "The engine reads the entire work — topic, objectives, methods, findings."],
  ["Analyse", "A health scorecard across structure, figures, tables, abbreviations and references."],
  ["Propose", "Every correction is explained and waits for your decision. Nothing is invented."],
  ["Rebuild", "Sections reordered, figures and tables renumbered, TOC and lists regenerated."],
  ["Verify", "A second pass checks the rebuilt document before you ever see it."],
  ["Preview & export", "Paginated on-screen preview, then a Word document you can submit."],
];

function Index() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main>
        <section className="mx-auto max-w-4xl px-5 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Academic document engine
          </p>
          <h1 className="mt-5 font-display text-5xl leading-tight sm:text-6xl">
            Your thesis, rebuilt to the standard your institution actually requires.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AcadFormat reads your dissertation, project or internship report end to end, audits it
            against verified institutional rules, proposes every correction for your approval, and
            regenerates a submission-ready document.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Open my documents" : "Upload a document"}
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-secondary/40 py-20">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(([title, body], index) => (
              <div key={title}>
                <span className="font-display text-3xl text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-lg font-medium">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-3xl">Verified formats only</h2>
          <p className="mt-4 text-muted-foreground">
            The College of Technology (COLTECH), University of Bamenda has its own configuration,
            taken directly from its official format document. Faculties that share the common
            project and internship-report structure inherit a single shared configuration.
          </p>
        </section>
      </main>
      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        AcadFormat — analysis, restructuring and formatting for academic work.
      </footer>
    </div>
  );
}
