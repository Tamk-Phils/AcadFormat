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
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader user={user} />
      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-4xl px-5 py-20 sm:py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary">
            Academic Document Formatting Engine
          </span>

          <h1 className="mt-5 font-display text-4xl leading-tight sm:text-6xl font-normal">
            Your thesis, rebuilt to the standard your institution actually requires.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            AcadFormat reads your dissertation, project or internship report end to end, audits it
            against verified institutional rules, proposes every correction for your approval, and
            regenerates a submission-ready document with 100% verbatim text fidelity.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="h-11 px-6">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Open My Documents" : "Upload Your Document"}
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-11 px-6 gap-2">
              <Link to="/docs">
                <BookOpen className="h-4 w-4" /> How to Use Guide
              </Link>
            </Button>
          </div>
        </section>

        {/* 6-Step Process */}
        <section className="border-t border-border bg-secondary/40 py-20">
          <div className="mx-auto max-w-5xl px-5">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl">How AcadFormat Rebuilds Your Work</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A deterministic 6-step pipeline guaranteeing zero content loss.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, body], index) => (
                <div key={title} className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
                  <span className="font-display text-3xl text-accent font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-medium">{title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Verified Formats Section */}
        <section className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="font-display text-3xl">Verified Institutional Standards</h2>
          <p className="mt-4 text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            The College of Technology (COLTECH), University of Bamenda configuration is taken directly from its official format standard document. Other institutions share standard academic thesis layouts.
          </p>

          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/institutions">
                View Institutional Specifications <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
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
                  <div key={review.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6">
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
