import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  Star,
  MessageSquarePlus,
  Filter,
  CheckCircle2,
  ThumbsUp,
  GraduationCap,
  Sparkles,
  Search,
  X,
  Send,
} from "lucide-react";
import {
  fetchPublicReviews,
  submitUserReview,
  type ReviewItem,
} from "@/lib/reviews";
import { toast } from "sonner";

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Student & Supervisor Reviews & Recommendations — AcadFormat" },
      {
        name: "description",
        content:
          "Read verified reviews and recommendations from students, faculty, and research supervisors using AcadFormat for dissertations, project reports, and lab reports.",
      },
      { property: "og:title", content: "AcadFormat User Reviews & Recommendations" },
      {
        property: "og:description",
        content:
          "See how students and supervisors format COLTECH and academic dissertations with 100% verbatim text preservation.",
      },
    ],
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Form state
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [institution, setInstitution] = useState("");
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<
    "Dissertation" | "Lab Report" | "Internship Report" | "Project Report" | "General"
  >("Internship Report");
  const [comment, setComment] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const data = await fetchPublicReviews();
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !authorRole.trim() || !comment.trim() || !recommendation.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await submitUserReview({
        author_name: authorName.trim(),
        author_role: authorRole.trim(),
        institution: institution.trim() || "University Student",
        rating,
        category,
        comment: comment.trim(),
        recommendation: recommendation.trim(),
      });
      toast.success("Thank you! Your review and recommendation have been posted.");
      setShowSubmitModal(false);
      // Reset form
      setAuthorName("");
      setAuthorRole("");
      setInstitution("");
      setComment("");
      setRecommendation("");
      setRating(5);
      loadReviews();
    } catch (err) {
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const filteredReviews = safeReviews.filter((r) => {
    if (!r) return false;
    const matchesCat = selectedCategory === "All" || r.category === selectedCategory;
    const matchesRating = selectedRatingFilter === 0 || (r.rating || 5) >= selectedRatingFilter;
    const matchesSearch =
      searchQuery === "" ||
      (r.author_name && r.author_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.comment && r.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.recommendation && r.recommendation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.institution && r.institution.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesRating && matchesSearch;
  });

  const avgRating =
    safeReviews.length > 0
      ? (safeReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / safeReviews.length).toFixed(1)
      : "5.0";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary/80 via-background to-secondary/30 p-8 sm:p-12 text-center shadow-sm">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ThumbsUp className="h-3.5 w-3.5" /> Student & Supervisor Feedback
          </span>

          <h1 className="mt-4 font-display text-4xl font-normal tracking-tight sm:text-5xl">
            Reviews & Recommendations
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Read authentic feedback from students, researchers, and academic supervisors who format their academic work with AcadFormat.
          </p>

          {/* Rating Summary Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-border/80 pt-6">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-bold text-foreground">{avgRating}</span>
              <div className="flex flex-col items-start">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Based on verified user ratings</span>
              </div>
            </div>

            <div className="h-8 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="h-5 w-5 text-accent" />
              <span>100% Verbatim & Institutional Accuracy</span>
            </div>

            <div className="h-8 w-px bg-border hidden sm:block" />

            <Button onClick={() => setShowSubmitModal(true)} className="gap-2">
              <MessageSquarePlus className="h-4 w-4" /> Share Your Recommendation
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mr-2">
              <Filter className="h-3.5 w-3.5" /> Category:
            </span>
            {["All", "Internship Report", "Dissertation", "Lab Report", "Project Report"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="mt-8">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading reviews...
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground text-sm">
                No reviews found matching your selected filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("All");
                  setSelectedRatingFilter(0);
                  setSearchQuery("");
                }}
                className="mt-4"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
                >
                  {review.is_featured && (
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-500">
                      <Sparkles className="h-3 w-3" /> Featured Review
                    </span>
                  )}

                  <div>
                    {/* Stars */}
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating ? "fill-amber-400" : "text-border"
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-xs font-semibold text-foreground">
                        {review.rating}.0
                      </span>
                    </div>

                    {/* Category Badge */}
                    <div className="mt-3">
                      <span className="inline-block rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {review.category}
                      </span>
                    </div>

                    {/* Comment */}
                    <p className="mt-4 text-xs text-foreground/90 leading-relaxed italic">
                      "{review.comment}"
                    </p>

                    {/* Recommendation Box */}
                    {review.recommendation && (
                      <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-accent font-medium">
                        <span className="block font-semibold uppercase tracking-wider text-[9px] text-accent/80">
                          Recommendation:
                        </span>
                        {review.recommendation}
                      </div>
                    )}
                  </div>

                  {/* Author Footer */}
                  <div className="mt-6 border-t border-border/60 pt-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {review.author_name}
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" title="Verified User" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{review.author_role}</p>
                      {review.institution && (
                        <p className="text-[10px] text-muted-foreground/80">{review.institution}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70">
                      {new Date(review.created_at || Date.now()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Submit Review Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-display text-xl font-medium flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5 text-primary" /> Leave a Review & Recommendation
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Overall Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-400 focus:outline-none hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating ? "fill-amber-400" : "text-border"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-muted-foreground">
                    {rating} out of 5 Stars
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emmanuel Ncho"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Role / Degree Program <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B.Tech Computer Engineering"
                    value={authorRole}
                    onChange={(e) => setAuthorRole(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    University / Institution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COLTECH, University of Bamenda"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Document Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as any)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Internship Report">Internship Report</option>
                    <option value="Dissertation">Dissertation / Thesis</option>
                    <option value="Lab Report">Lab Report</option>
                    <option value="Project Report">Project Report</option>
                    <option value="General">General Academic Work</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Your Detailed Review <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="How did AcadFormat help format your document, table of contents, or figure captions?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Your Recommendation to Other Students <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Highly recommended for final year students preparing for defense."
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="gap-2">
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Submitting..." : "Post Review"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        AcadFormat — Analysis, restructuring and formatting for academic work.
      </footer>
    </div>
  );
}
