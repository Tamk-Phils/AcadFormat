import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(error), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Implement standard CSRF protection manually to avoid the circular dependency 
// bug on Vercel/Nitro builds when importing createCsrfMiddleware from @tanstack/react-start.
const csrfMiddleware = createMiddleware().server(async (ctx) => {
  if (ctx.handlerType !== "serverFn") {
    return ctx.next();
  }

  const origin = ctx.request.headers.get("Origin");
  const fetchSite = ctx.request.headers.get("Sec-Fetch-Site");

  // 1. Sec-Fetch-Site check (modern browser standard)
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return new Response("Forbidden (CSRF)", { status: 403 });
  }

  // 2. Origin header check
  if (origin !== null) {
    try {
      const requestOrigin = new URL(ctx.request.url).origin;
      if (origin !== requestOrigin) {
        return new Response("Forbidden (CSRF)", { status: 403 });
      }
    } catch {
      return new Response("Forbidden (CSRF)", { status: 403 });
    }
  }

  return ctx.next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
