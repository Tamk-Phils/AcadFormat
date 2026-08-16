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
        } else {
          // Regular user is signed in -> remove any residual admin key
          localStorage.removeItem(ADMIN_SESSION_KEY);
          setIsAdmin(false);
        }
      } else {
        const saved = localStorage.getItem(ADMIN_SESSION_KEY);
        setIsAdmin(saved === "true");
      }
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
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="AcadFormat" className="h-9 w-auto object-contain" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">AcadFormat</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            <Link to="/docs">How to Use</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            <Link to="/institutions">Institutions</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            <Link to="/reviews">Reviews</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {effectiveUser ? (
            <>
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                <Link to="/dashboard">My documents</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="h-8 px-3 text-xs sm:text-sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}