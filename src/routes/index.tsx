import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle2, MessageSquare, ArrowRight, BookOpen } from "lucide-react";
import { fetchPublicReviews, type ReviewItem } from "@/lib/reviews";

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
  const [featuredReviews, setFeaturedReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    fetchPublicReviews().then((revs) => {
      setFeaturedReviews(revs.slice(0, 3));
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <SiteHeader user={user} />
      <main>
        {/* Hero Section */}
        <section className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-20 sm:pb-28 text-center">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Academic Document Formatting Engine
          </span>

          <h1 className="mt-6 font-display text-4xl leading-tight sm:text-6xl font-normal max-w-4xl mx-auto tracking-tight">
            Your thesis, rebuilt to the standard your institution actually requires.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg leading-relaxed">
            AcadFormat reads your dissertation, project or internship report end to end, audits it
            against verified institutional rules, proposes every correction for your approval, and
            regenerates a submission-ready document with 100% verbatim text fidelity.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 text-sm font-medium shadow-lg hover:shadow-primary/20 transition-all">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Open My Documents" : "Upload Your Document"}
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-12 px-7 text-sm gap-2">
              <Link to="/docs">
                <BookOpen className="h-4 w-4 text-primary" /> How to Use Guide
              </Link>
            </Button>
          </div>

          {/* Hero Feature Showcase Image Mockup */}
          <div className="mt-14 relative mx-auto max-w-5xl rounded-2xl border border-border/80 bg-card/60 p-2 sm:p-4 shadow-2xl backdrop-blur-xs group">
            <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950">
              <img
                src="/hero-showcase.png"
                alt="AcadFormat AI Document Editor Workspace Showcase"
                className="w-full h-auto object-cover rounded-lg transform transition-transform duration-500 group-hover:scale-[1.01]"
              />
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto flex flex-wrap gap-2">
                <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-white font-medium flex items-center gap-2 shadow-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>100% Verbatim Text Preservation</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-white font-medium flex items-center gap-2 shadow-lg">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span>Verified University Compliance</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Transformation Showcase (Before vs After) */}
        <section className="border-t border-border bg-secondary/30 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Visual Document Precision
                </span>
                <h2 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">
                  Transform Unstructured Drafts into Submission-Ready Academic Papers
                </h2>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Say goodbye to lost section headings, broken table borders, and invalid page number alignment. AcadFormat automatically handles chapter renumbering, table formatting, figure captions, and Table of Contents generation while leaving your core research text untouched.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 text-xs text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Formal Chapter & Section Hierarchy:</strong> Auto-cleans duplicate chapter labels and formats standard academic headers.</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>High-Fidelity Table & Figure Parsing:</strong> Preserves raw table structures and places figures exactly where referenced.</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Roman & Arabic Page Pagination:</strong> Standardizes preliminary Roman numerals and main body page numbers.</span>
                  </div>
                </div>

                <div className="mt-8">
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/auth">
                      Try Formatting Your Document <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="relative rounded-2xl border border-border bg-card p-3 shadow-xl overflow-hidden">
                <img
                  src="/before-after-showcase.png"
                  alt="Before and After Academic Document Formatting Comparison"
                  className="w-full h-auto rounded-xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 6-Step Process with Visual Restructuring Card */}
        <section className="border-t border-border bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Deterministic Formatting Pipeline
              </span>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">How AcadFormat Rebuilds Your Work</h2>
              <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
                A structured 6-step workflow guaranteeing complete accuracy across structure, tables, and citations.
              </p>
            </div>

            {/* Restructuring Visual Banner */}
            <div className="mb-14 rounded-2xl border border-border bg-slate-950 p-3 sm:p-5 shadow-2xl">
              <img
                src="/restructuring-showcase.png"
                alt="Document Restructuring and Health Scorecard Panel"
                className="w-full h-auto rounded-xl object-cover max-h-[500px]"
              />
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="rounded-xl border border-border/80 bg-card p-6 shadow-xs hover:border-primary/40 transition-colors">
                  <span className="font-display text-3xl text-accent font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Verified Institutional Standards Section with Standards Showcase Image */}
        <section className="border-t border-border bg-secondary/40 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 rounded-2xl border border-border bg-card p-3 shadow-xl overflow-hidden">
                <img
                  src="/standards-showcase.png"
                  alt="University Thesis Formatting Standards and Certification Guidelines"
                  className="w-full h-auto rounded-xl object-cover"
                />
              </div>

              <div className="order-1 md:order-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Official Institutional Formatting
                </span>
                <h2 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">
                  Verified Institutional Specifications & Guidelines
                </h2>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Configurations for institutions like The College of Technology (COLTECH), University of Bamenda are derived directly from official academic guidelines. All structural elements — certification pages, declarations, preliminary orders, and cover headers — match institutional rules.
                </p>

                <div className="mt-8">
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to="/institutions">
                      View Institutional Specifications <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Student & Supervisor Reviews */}
        {featuredReviews.length > 0 && (
          <section className="border-t border-border bg-card py-20">
            <div className="mx-auto max-w-5xl px-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-accent font-semibold">
                    Verified Feedback
                  </span>
                  <h2 className="mt-1 font-display text-3xl">Student & Supervisor Reviews</h2>
                </div>

                <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                  <Link to="/reviews">
                    <MessageSquare className="h-4 w-4" /> View All Reviews & Recommendations
                  </Link>
                </Button>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {featuredReviews.map((review) => (
                  <div key={review.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 shadow-xs">
                    <div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < review.rating ? "fill-amber-400" : "text-border"}`}
                          />
                        ))}
                      </div>

                      <p className="mt-3 text-xs text-foreground/90 leading-relaxed italic">
                        "{review.comment}"
                      </p>

                      {review.recommendation && (
                        <p className="mt-3 text-xs text-accent font-medium bg-accent/5 p-2.5 rounded border border-accent/20">
                          {review.recommendation}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 border-t border-border pt-3">
                      <h4 className="text-xs font-semibold flex items-center gap-1">
                        {review.author_name}
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{review.author_role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        AcadFormat — analysis, restructuring and formatting for academic work.
      </footer>
    </div>
  );
}
