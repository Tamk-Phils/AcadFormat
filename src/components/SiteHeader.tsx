import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAIL = "philss7872@gmail.com";
const ADMIN_SESSION_KEY = "acadformat_admin_authenticated";

export function SiteHeader({ user }: { user?: User | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(user ?? null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    async function evaluateAdmin(u: User | null) {
      if (u) {
        if (u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          setIsAdmin(true);
          return;
        }

        // Active user is NOT an admin - strip admin state and local session override
        localStorage.removeItem(ADMIN_SESSION_KEY);
        setIsAdmin(false);
        return;
      }

      // Guest / unauthenticated fallback
      const saved = localStorage.getItem(ADMIN_SESSION_KEY) === "true";
      setIsAdmin(saved);
    }

    if (user !== undefined) {
      setCurrentUser(user);
      evaluateAdmin(user);
    } else {
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUser(data.user);
        evaluateAdmin(data.user);
      });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setCurrentUser(u);
      evaluateAdmin(u);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [user]);

  async function signOut() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const effectiveUser = user !== undefined ? user : currentUser;

  return (
    <header className="no-print sticky top-0 z-30 border-b border-white/10 bg-[#030712]/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <img src="/logo.png" alt="AcadFormat" className="h-9 w-auto object-contain transition-transform group-hover:scale-105" />
          <span className="font-display text-xl font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors">AcadFormat</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-300">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm hover:text-white hover:bg-white/10">
            <Link to="/docs">How to Use</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm hover:text-white hover:bg-white/10">
            <Link to="/institutions">Institutions</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm hover:text-white hover:bg-white/10">
            <Link to="/reviews">Reviews</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 font-semibold">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {effectiveUser ? (
            <>
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20">
                <Link to="/dashboard">Workspace</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm border-white/10 hover:bg-white/10 text-white" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="h-8 px-3 text-xs sm:text-sm bg-white text-black hover:bg-slate-200">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}