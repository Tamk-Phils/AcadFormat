import { supabaseAdmin } from "@/integrations/supabase/client.server";

let bucketReady = false;

/**
 * Ensures the "documents" storage bucket exists.
 * Uses the service-role admin client — silently skips if SUPABASE_SERVICE_ROLE_KEY is absent.
 */
export async function ensureDocumentsBucket() {
  if (bucketReady) return;

  // Skip if no service role key — user must create bucket manually in the Supabase dashboard
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;

  const { error } = await supabaseAdmin.storage.createBucket("documents", {
    public: false,
    fileSizeLimit: 52428800, // 50 MB
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  });

  // "already exists" is fine
  if (!error || error.message.toLowerCase().includes("already exists") || error.message.toLowerCase().includes("already been created")) {
    bucketReady = true;
  } else {
    console.warn("[storage] bucket creation warning:", error.message);
  }
}
