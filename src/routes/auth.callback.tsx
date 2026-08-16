import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          if (mounted) {
            toast.success("Successfully authenticated!");
            navigate({ to: "/dashboard", replace: true });
          }
          return;
        }

        // If no session found yet, listen for auth state change
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
            if (mounted) {
              toast.success("Successfully authenticated!");
              navigate({ to: "/dashboard", replace: true });
            }
          }
        });

        // Fallback timeout in case auth fails or is cancelled
        const timeout = setTimeout(() => {
          if (mounted) {
            setErrorMsg("Authentication timed out or failed. Returning to sign-in page.");
            setTimeout(() => navigate({ to: "/auth", replace: true }), 2000);
          }
        }, 5000);

        return () => {
          authListener.subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err) {
        if (mounted) {
          console.error("Auth callback error:", err);
          toast.error("Authentication failed.");
          navigate({ to: "/auth", replace: true });
        }
      }
    }

    void handleCallback();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-4">
        {errorMsg ? (
          <p className="text-sm font-medium text-destructive">{errorMsg}</p>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h2 className="font-display text-2xl font-semibold">Completing Sign-In...</h2>
            <p className="text-xs text-muted-foreground">
              Please wait while we verify your authentication credentials and set up your workspace.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
