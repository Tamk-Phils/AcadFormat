import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export function SiteHeader({ user }: { user?: User | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="AcadFormat" className="h-9 w-auto object-contain" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">AcadFormat</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            <Link to="/docs">Documentation</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
            <Link to="/institutions">Institutions</Link>
          </Button>
          {user ? (
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