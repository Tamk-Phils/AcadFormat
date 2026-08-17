import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AcadFormat" },
      { name: "description", content: "Sign in to analyse, format and export your academic documents." },
      { property: "og:title", content: "Sign in — AcadFormat" },
      { property: "og:description", content: "Access your AcadFormat document workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn("Clearing stale auth session:", error.message);
        supabase.auth.signOut().catch(() => {});
        return;
      }
      if (data.session) navigate({ to: "/dashboard", replace: true });
    }).catch(() => {
      supabase.auth.signOut().catch(() => {});
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        toast.success("Successfully signed in!");
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (error: any) {
      const errMsg = error?.message || "Authentication failed.";
      if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("jwt")) {
        // Purge old local storage keys from previous project
        if (typeof window !== "undefined") {
          localStorage.clear();
        }
        toast.error("Session updated. Please try signing in again.");
      } else if (errMsg.toLowerCase().includes("rate limit")) {
        toast.error("Email send limit reached. Please check your inbox or disable email confirmation in Supabase.");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;

      // Try direct Supabase OAuth first
      const { error: sbError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (sbError) {
        console.warn("Direct Supabase OAuth notice:", sbError);
        // Try Lovable Cloud Auth adapter
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: redirectUrl,
        });

        if (result?.error) {
          throw sbError || result.error;
        }
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("provider") || msg.includes("not enabled") || msg.includes("404")) {
        toast.error("Google authentication provider is not enabled in Supabase yet. Please register or sign in with your email below.");
        setMode("signup");
      } else {
        toast.error("Google sign-in failed. Please try signing up with your email.");
      }
      setGoogleBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col justify-center px-5 py-16">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-3xl">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              Your documents and analyses stay private to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-border hover:bg-secondary/50 transition-colors h-10 font-medium text-sm"
              onClick={google}
              disabled={googleBusy || busy}
            >
              {googleBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              {googleBusy ? "Redirecting to Google…" : "Continue with Google"}
            </Button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || googleBusy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}