import { supabase } from "@/integrations/supabase/client";

export interface ReviewItem {
  id: string;
  author_name: string;
  author_role: string;
  institution?: string;
  rating: number; // 1 to 5
  comment: string;
  recommendation: string;
  category: "Dissertation" | "Lab Report" | "Internship Report" | "Project Report" | "General";
  status: "approved" | "pending";
  is_featured: boolean;
  created_at: string;
}

const STORAGE_KEY = "acadformat_user_reviews_v1";

const INITIAL_SEED_REVIEWS: ReviewItem[] = [
  {
    id: "rev-1",
    author_name: "Emmanuel Ncho",
    author_role: "B.Tech Computer Engineering",
    institution: "COLTECH, University of Bamenda",
    rating: 5,
    comment:
      "AcadFormat saved my final year internship report! The College of Technology formatting rules are super strict, especially chapter titles, margins, and table of contents. AcadFormat audited my document, fixed my table numbering, and generated a flawless Word document.",
    recommendation:
      "Highly recommended for all COLTECH students preparing their final defense documents.",
    category: "Internship Report",
    status: "approved",
    is_featured: true,
    created_at: "2026-08-14T10:30:00Z",
  },
  {
    id: "rev-2",
    author_name: "Dr. Therese Mbida",
    author_role: "Senior Academic Supervisor",
    institution: "Faculty of Engineering",
    rating: 5,
    comment:
      "As a supervisor, I spent hours rejecting drafts due to missing figure captions and wrong citations. AcadFormat ensures 100% verbatim text preservation while organizing preliminary pages perfectly.",
    recommendation:
      "Every graduating student should run their thesis through AcadFormat before submission.",
    category: "Dissertation",
    status: "approved",
    is_featured: true,
    created_at: "2026-08-15T14:15:00Z",
  },
  {
    id: "rev-3",
    author_name: "Brenda Tangu",
    author_role: "M.Tech Software Engineering",
    institution: "University of Bamenda",
    rating: 5,
    comment:
      "Our Cisco VLAN lab report had complex network topology diagrams and multi-column addressing tables. Other tools destroyed the layout, but AcadFormat extracted all figures and kept tables intact!",
    recommendation:
      "Essential for technical lab reports with embedded diagrams and CLI command snippets.",
    category: "Lab Report",
    status: "approved",
    is_featured: true,
    created_at: "2026-08-16T09:45:00Z",
  },
  {
    id: "rev-4",
    author_name: "Kevin Fobi",
    author_role: "B.Eng Electrical Engineering",
    institution: "NAHPI, University of Bamenda",
    rating: 4,
    comment:
      "The automatic generation of List of Figures, List of Tables, and Abbreviations list saved me two days of manual work.",
    recommendation:
      "Great platform. The PDF export and Word doc download both look clean and professional.",
    category: "Project Report",
    status: "approved",
    is_featured: false,
    created_at: "2026-08-16T12:20:00Z",
  },
];

function getStoredReviews(): ReviewItem[] {
  if (typeof window === "undefined") return INITIAL_SEED_REVIEWS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_REVIEWS));
      return INITIAL_SEED_REVIEWS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SEED_REVIEWS;
  } catch (err) {
    console.error("Failed to read stored reviews:", err);
    return INITIAL_SEED_REVIEWS;
  }
}

function saveStoredReviews(reviews: ReviewItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } catch (err) {
    console.error("Failed to save reviews:", err);
  }
}

export async function fetchPublicReviews(): Promise<ReviewItem[]> {
  try {
    const { data, error } = await supabase
      .from("reviews" as any)
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as ReviewItem[];
    }
  } catch (err) {
    console.error("Error fetching public reviews from Supabase:", err);
  }

  const reviews = getStoredReviews();
  return (Array.isArray(reviews) ? reviews : INITIAL_SEED_REVIEWS).filter(
    (r) => r && r.status === "approved"
  );
}

export async function fetchAllReviewsAdmin(): Promise<ReviewItem[]> {
  try {
    const { data, error } = await supabase
      .from("reviews" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as ReviewItem[];
    }
  } catch (err) {
    console.error("Error fetching admin reviews from Supabase:", err);
  }

  const reviews = getStoredReviews();
  return Array.isArray(reviews) ? reviews : INITIAL_SEED_REVIEWS;
}

export async function submitUserReview(
  input: Omit<ReviewItem, "id" | "created_at" | "status" | "is_featured">
): Promise<ReviewItem> {
  const newReview: ReviewItem = {
    ...input,
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "approved", // Auto-approved for immediate user feedback
    is_featured: input.rating >= 5,
    created_at: new Date().toISOString(),
  };

  // Attempt Supabase insert
  try {
    await supabase.from("reviews" as any).insert(newReview as any);
  } catch (err) {
    // Fallback save
  }

  const current = getStoredReviews();
  const updated = [newReview, ...current];
  saveStoredReviews(updated);
  return newReview;
}

export async function updateReviewStatusAdmin(
  id: string,
  updates: Partial<Pick<ReviewItem, "status" | "is_featured" | "rating" | "comment" | "recommendation">>
): Promise<void> {
  try {
    await supabase.from("reviews" as any).update(updates as any).eq("id", id);
  } catch (err) {
    // Ignore
  }

  const current = getStoredReviews();
  const updated = current.map((r) => (r.id === id ? { ...r, ...updates } : r));
  saveStoredReviews(updated);
}

export async function deleteReviewAdmin(id: string): Promise<void> {
  try {
    await supabase.from("reviews" as any).delete().eq("id", id);
  } catch (err) {
    // Ignore
  }

  const current = getStoredReviews();
  const updated = current.filter((r) => r.id !== id);
  saveStoredReviews(updated);
}
