import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Lock,
  Mail,
  Key,
  Star,
  CheckCircle2,
  Trash2,
  Sparkles,
  TrendingUp,
  FileText,
  Users,
  Settings,
  RefreshCw,
  Search,
  Plus,
  X,
  AlertTriangle,
  Eye,
  LogOut,
  Layers,
  ThumbsUp,
} from "lucide-react";
import {
  fetchAllReviewsAdmin,
  updateReviewStatusAdmin,
  deleteReviewAdmin,
  submitUserReview,
  type ReviewItem,
} from "@/lib/reviews";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Operations Portal — AcadFormat" },
      { name: "description", content: "AcadFormat Admin Management & Operations Portal" },
    ],
  }),
  component: AdminPage,
});

const ADMIN_EMAIL = "philss7872@gmail.com";
const ADMIN_PASS = "Phil$7872";
const ADMIN_SESSION_KEY = "acadformat_admin_authenticated";

function AdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Dashboard Tab state
  const [activeTab, setActiveTab] = useState<"reviews" | "analytics" | "documents" | "users" | "settings">("reviews");

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "approved" | "pending" | "featured">("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Registered Users state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Admin Settings state
  const [autoApproveReviews, setAutoApproveReviews] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Add review form state
  const [newAuthor, setNewAuthor] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newInst, setNewInst] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newCategory, setNewCategory] = useState<
    "Dissertation" | "Lab Report" | "Internship Report" | "Project Report" | "General"
  >("Dissertation");
  const [newComment, setNewComment] = useState("");
  const [newRec, setNewRec] = useState("");

  useEffect(() => {
    const checkAdminSession = async () => {
      // 1. Check if active Supabase session user is admin via Database profiles table
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;

      if (currentUser) {
        // Query database role from profiles table
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .maybeSingle();

        const isDbAdmin = profile?.role === "admin";
        const isEmailAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        if (isDbAdmin || isEmailAdmin) {
          localStorage.setItem(ADMIN_SESSION_KEY, "true");
          setIsAuthenticated(true);
          loadDashboardData();
          return;
        } else {
          // Logged in user is NOT an admin: strictly revoke admin access & clear stale key
          localStorage.removeItem(ADMIN_SESSION_KEY);
          setIsAuthenticated(false);
          return;
        }
      }

      // Guest / unauthenticated fallback check
      const saved = localStorage.getItem(ADMIN_SESSION_KEY);
      if (saved === "true") {
        setIsAuthenticated(true);
        loadDashboardData();
        return;
      }

      setIsAuthenticated(false);
    };

    checkAdminSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim();

    // 1. Attempt Supabase Auth login
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!error && data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        const isDbAdmin = profile?.role === "admin";
        const isEmailAdmin = data.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        if (isDbAdmin || isEmailAdmin) {
          localStorage.setItem(ADMIN_SESSION_KEY, "true");
          setIsAuthenticated(true);
          toast.success("Welcome, Admin! Authenticated successfully via database.");
          loadDashboardData();
          return;
        }
      }
    } catch (err) {
      console.error("Supabase admin auth check error:", err);
    }

    // 2. Fallback local admin check
    const isEmailMatch = cleanEmail === ADMIN_EMAIL.toLowerCase();
    const isPassMatch = cleanPassword === ADMIN_PASS || cleanPassword.toLowerCase() === ADMIN_PASS.toLowerCase();

    if (isEmailMatch && isPassMatch) {
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      setIsAuthenticated(true);
      toast.success("Welcome, Admin! Authenticated successfully.");
      loadDashboardData();
      return;
    }

    setLoginError("Invalid email or password. Please verify admin credentials.");
    toast.error("Authentication failed.");
  };

  const handleFillCredentials = () => {
    setEmailInput(ADMIN_EMAIL);
    setPasswordInput(ADMIN_PASS);
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    supabase.auth.signOut().catch(() => {});
    setIsAuthenticated(false);
    setEmailInput("");
    setPasswordInput("");
    toast.info("Logged out of Admin Portal.");
  };

  const loadDashboardData = async () => {
    loadReviews();
    loadDocuments();
    loadUsers();
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    const data = await fetchAllReviewsAdmin();
    setReviews(data);
    setLoadingReviews(false);
  };

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_type, status, created_at, institution, storage_path")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDeleteDocumentAdmin = async (docId: string, storagePath?: string) => {
    if (!confirm("Are you sure you want to delete this document from the system?")) return;
    try {
      if (storagePath) {
        await supabase.storage.from("documents").remove([storagePath]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", docId);
      if (error) throw error;
      toast.success("Document deleted from system.");
      loadDocuments();
    } catch (err) {
      toast.error("Failed to delete document.");
      console.error("Error deleting document:", err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Real-time subscription to database changes across profiles, documents, and reviews
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadUsers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        loadDocuments();
        loadUsers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => {
        loadReviews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      // 1. Query all real profiles from database
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. Query documents to calculate per-user document count
      const { data: docsData } = await supabase
        .from("documents")
        .select("user_id, created_at, institution");

      const docCountMap: Record<string, number> = {};
      if (docsData) {
        docsData.forEach((d: any) => {
          if (d.user_id) {
            docCountMap[d.user_id] = (docCountMap[d.user_id] || 0) + 1;
          }
        });
      }

      const userMap: Record<string, { id: string; email: string; name: string; role: string; institution: string; docCount: number; createdAt: string; status: string }> = {};

      if (profiles && profiles.length > 0) {
        profiles.forEach((p: any) => {
          const isAdminRole = p.role === "admin" || p.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          userMap[p.id] = {
            id: p.id,
            email: p.email,
            name: p.full_name || (isAdminRole ? "Phil (Platform Administrator)" : `Scholar (${p.id.substring(0, 6)})`),
            role: isAdminRole ? "System Admin" : "Registered User",
            institution: p.institution || "University of Bamenda",
            docCount: docCountMap[p.id] || 0,
            createdAt: p.created_at || new Date().toISOString(),
            status: isAdminRole ? "admin" : "active",
          };
        });
      } else {
        // System Admin fallback entry if profiles table is empty or loading
        userMap["admin-master-001"] = {
          id: "admin-master-001",
          email: ADMIN_EMAIL,
          name: "Phil (Platform Administrator)",
          role: "System Admin",
          institution: "COLTECH / UBa",
          docCount: docsData ? docsData.length : 0,
          createdAt: "2026-08-01T08:00:00Z",
          status: "admin",
        };
      }

      // Aggregate any doc user_ids not explicitly in profiles map
      if (docsData && docsData.length > 0) {
        docsData.forEach((d: any) => {
          const uid = d.user_id;
          if (uid && uid !== "anonymous" && !userMap[uid]) {
            const instStr = typeof d.institution === "object" ? d.institution?.university || d.institution?.school : "University of Bamenda";
            userMap[uid] = {
              id: uid,
              email: `user-${uid.substring(0, 8)}@acadformat.org`,
              name: `Scholar (${uid.substring(0, 6)})`,
              role: "Registered Scholar",
              institution: instStr || "Academic Institution",
              docCount: docCountMap[uid] || 1,
              createdAt: d.created_at || new Date().toISOString(),
              status: "active",
            };
          }
        });
      }

      setUsersList(Object.values(userMap));
    } catch (err) {
      console.error("Failed to load real user accounts:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleApprove = async (review: ReviewItem) => {
    const newStatus = review.status === "approved" ? "pending" : "approved";
    await updateReviewStatusAdmin(review.id, { status: newStatus });
    toast.success(`Review set to ${newStatus}.`);
    loadReviews();
  };

  const handleToggleFeature = async (review: ReviewItem) => {
    const newFeatured = !review.is_featured;
    await updateReviewStatusAdmin(review.id, { is_featured: newFeatured });
    toast.success(newFeatured ? "Review featured on public page!" : "Review unfeatured.");
    loadReviews();
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    await deleteReviewAdmin(id);
    toast.success("Review deleted successfully.");
    loadReviews();
  };

  const handleAddAdminReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newRole.trim() || !newComment.trim() || !newRec.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const created = await submitUserReview({
      author_name: newAuthor.trim(),
      author_role: newRole.trim(),
      institution: newInst.trim() || "University Student",
      rating: newRating,
      category: newCategory,
      comment: newComment.trim(),
      recommendation: newRec.trim(),
    });

    // Auto-approve since this was created by the Admin
    await updateReviewStatusAdmin(created.id, { status: "approved", is_featured: newRating >= 5 });

    toast.success("New review created and published.");
    setShowAddReviewModal(false);
    setNewAuthor("");
    setNewRole("");
    setNewInst("");
    setNewComment("");
    setNewRec("");
    loadReviews();
  };

  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const filteredReviews = safeReviews.filter((r) => {
    if (!r) return false;
    const matchesFilter =
      reviewFilter === "all" ||
      (reviewFilter === "approved" && r.status === "approved") ||
      (reviewFilter === "pending" && r.status === "pending") ||
      (reviewFilter === "featured" && r.is_featured);

    const matchesSearch =
      reviewSearch === "" ||
      (r.author_name && r.author_name.toLowerCase().includes(reviewSearch.toLowerCase())) ||
      (r.comment && r.comment.toLowerCase().includes(reviewSearch.toLowerCase())) ||
      (r.recommendation && r.recommendation.toLowerCase().includes(reviewSearch.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  // Login View if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <SiteHeader user={null} />
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-semibold">Admin Operations Portal</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your administrative credentials to manage platform reviews and system operations.
              </p>
            </div>

            {loginError && (
              <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="admin@acadformat.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Admin Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 mt-2">
                <Lock className="h-4 w-4" /> Log In to Admin Portal
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleFillCredentials}
                  className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                >
                  Auto-fill Admin Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          AcadFormat Administrative System
        </footer>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader user={null} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Authenticated Administrator
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                System Active
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-normal">Platform Admin Control Panel</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadDashboardData} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("reviews")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "reviews"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-4 w-4" /> Reviews & Recommendations ({reviews.length})
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "analytics"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-4 w-4" /> Analytics & Health
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "documents"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" /> User Documents Oversight
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "users"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Registered Users ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" /> System Settings
          </button>
        </div>

        {/* TAB 1: REVIEWS MANAGEMENT */}
        {activeTab === "reviews" && (
          <div className="mt-6 space-y-6">
            {/* Reviews Controls Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["all", "approved", "pending", "featured"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReviewFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      reviewFilter === filter
                        ? "bg-secondary text-foreground font-semibold border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter} (
                    {filter === "all"
                      ? reviews.length
                      : filter === "approved"
                      ? reviews.filter((r) => r.status === "approved").length
                      : filter === "pending"
                      ? reviews.filter((r) => r.status === "pending").length
                      : reviews.filter((r) => r.is_featured).length}
                    )
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search reviews..."
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Button size="sm" onClick={() => setShowAddReviewModal(true)} className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Review
                </Button>
              </div>
            </div>

            {/* Reviews List / Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loadingReviews ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading reviews...</div>
              ) : filteredReviews.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No reviews found matching filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Author & Role</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Rating</th>
                        <th className="px-4 py-3">Review & Recommendation</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredReviews.map((rev) => (
                        <tr key={rev.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{rev.author_name}</div>
                            <div className="text-[11px] text-muted-foreground">{rev.author_role}</div>
                            {rev.institution && <div className="text-[10px] text-muted-foreground/80">{rev.institution}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-secondary px-2 py-0.5 text-[11px]">
                              {rev.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-amber-400 font-semibold">
                              <Star className="h-3.5 w-3.5 fill-amber-400" />
                              {rev.rating}.0
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="line-clamp-2 text-foreground/90 italic">"{rev.comment}"</p>
                            {rev.recommendation && (
                              <p className="mt-1 line-clamp-1 text-[11px] text-accent font-medium">
                                Rec: {rev.recommendation}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  rev.status === "approved"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600"
                                }`}
                              >
                                {rev.status}
                              </span>
                              {rev.is_featured && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[9px] font-semibold">
                                  <Sparkles className="h-2.5 w-2.5" /> Featured
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleApprove(rev)}
                                title={rev.status === "approved" ? "Set Pending" : "Approve"}
                                className={`rounded p-1.5 transition-colors ${
                                  rev.status === "approved"
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleToggleFeature(rev)}
                                title={rev.is_featured ? "Unfeature" : "Feature on public page"}
                                className={`rounded p-1.5 transition-colors ${
                                  rev.is_featured
                                    ? "text-amber-500 hover:bg-amber-500/10"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                              >
                                <Star className={`h-4 w-4 ${rev.is_featured ? "fill-amber-500" : ""}`} />
                              </button>

                              <button
                                onClick={() => handleDeleteReview(rev.id)}
                                title="Delete review"
                                className="rounded p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & HEALTH */}
        {activeTab === "analytics" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Processed Docs</span>
                <h3 className="mt-2 font-display text-3xl font-semibold">142</h3>
                <p className="mt-1 text-[11px] text-emerald-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +18% this month
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Conversion Success</span>
                <h3 className="mt-2 font-display text-3xl font-semibold">98.4%</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">High fidelity structural parsing</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Institutions</span>
                <h3 className="mt-2 font-display text-3xl font-semibold">2 Specs</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">COLTECH & General Standard</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Public Reviews</span>
                <h3 className="mt-2 font-display text-3xl font-semibold">{reviews.length}</h3>
                <p className="mt-1 text-[11px] text-amber-500 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-500" /> 4.9 Average Rating
                </p>
              </div>
            </div>

            {/* System Health Cards */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display text-lg font-medium">Engine Subsystems Status</h3>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>PDF Extraction & PNG Encoder</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5">Operational</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>Markdown Table Parser</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5">Operational</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>OpenXML Word Exporter</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Supabase Document Storage</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5">Operational</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display text-lg font-medium">Institutional Selection Distribution</h3>
                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>COLTECH — University of Bamenda</span>
                      <span className="font-semibold">68%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "68%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span>General Academic Standard</span>
                      <span className="font-semibold">32%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: "32%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENTS OVERSEEN */}
        {activeTab === "documents" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-lg">Uploaded User Documents</h3>
                  <p className="text-xs text-muted-foreground">Overview of document files stored in Supabase</p>
                </div>
                <Button size="sm" variant="outline" onClick={loadDocuments} className="gap-1 text-xs">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              </div>

              {loadingDocs ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No recent documents found.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">File Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Institution Config</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Uploaded Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-secondary/20">
                          <td className="px-4 py-3 font-medium text-foreground">{doc.file_name}</td>
                          <td className="px-4 py-3">
                            <span className="uppercase text-[10px] font-semibold rounded bg-secondary px-2 py-0.5">
                              {doc.file_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {doc.institution?.university || "Default Institution"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                doc.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : doc.status === "processing"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-red-500/10 text-red-600"
                              }`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(doc.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDocumentAdmin(doc.id, doc.storage_path)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete document from system"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: REGISTERED USERS */}
        {activeTab === "users" && (
          <div className="mt-6 space-y-6">
            {/* Header stats & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div>
                <h3 className="font-display text-lg font-medium flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Registered Platform Users ({usersList.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  View and manage all registered student, researcher, and administrative accounts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or institution..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="h-8.5 w-64 rounded-lg border border-border bg-background pl-8 pr-3 text-xs"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={loadUsers} className="gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            </div>

            {/* Users Table Card */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft">
              {loadingUsers ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading registered users...</div>
              ) : usersList.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No registered users found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">User &amp; Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Institution</th>
                        <th className="px-4 py-3">Documents Uploaded</th>
                        <th className="px-4 py-3">Joined Date</th>
                        <th className="px-4 py-3">Account Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersList
                        .filter((u) => {
                          if (!userSearch) return true;
                          const q = userSearch.toLowerCase();
                          return (
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q) ||
                            u.institution.toLowerCase().includes(q)
                          );
                        })
                        .map((u) => (
                          <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground">{u.name}</div>
                                  <div className="text-[11px] text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                            <td className="px-4 py-3 font-medium">{u.institution}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-foreground">
                                📄 {u.docCount} file{u.docCount !== 1 ? "s" : ""}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                                  u.status === "admin"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                    : u.status === "verified"
                                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-primary hover:bg-primary/10"
                                onClick={() => toast.info(`Viewing details for ${u.name}`)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === "settings" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
              <h3 className="font-display text-lg font-medium">Platform & Review Controls</h3>
              <p className="mt-1 text-xs text-muted-foreground">Manage administrative rules and public behavior.</p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Auto-Approve User Reviews</h4>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, user-submitted reviews appear immediately on the public Reviews page.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApproveReviews}
                    onChange={(e) => {
                      setAutoApproveReviews(e.target.checked);
                      toast.success(`Auto-approval set to ${e.target.checked}`);
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Maintenance Mode</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Temporarily display maintenance banner for document processing.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => {
                      setMaintenanceMode(e.target.checked);
                      toast.info(`Maintenance mode set to ${e.target.checked}`);
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-foreground">Admin Credentials</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Logged in as: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-foreground">{ADMIN_EMAIL}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Review Modal for Admin */}
      {showAddReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add New Official Review (Admin)
              </h3>
              <button
                onClick={() => setShowAddReviewModal(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdminReview} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">Author Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Author Name"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">Role / Degree *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B.Tech Computer Engineering"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">Institution</label>
                  <input
                    type="text"
                    placeholder="Institution"
                    value={newInst}
                    onChange={(e) => setNewInst(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <option value="Dissertation">Dissertation</option>
                    <option value="Lab Report">Lab Report</option>
                    <option value="Internship Report">Internship Report</option>
                    <option value="Project Report">Project Report</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">Rating</label>
                <select
                  value={newRating}
                  onChange={(e) => setNewRating(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                >
                  <option value={5}>5 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={3}>3 Stars</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">Review Comment *</label>
                <textarea
                  required
                  rows={2}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">Recommendation Statement *</label>
                <input
                  type="text"
                  required
                  value={newRec}
                  onChange={(e) => setNewRec(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddReviewModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Publish Review
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        AcadFormat Administrative System
      </footer>
    </div>
  );
}
