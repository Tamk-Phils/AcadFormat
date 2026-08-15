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

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
  ];

  const { error } = await supabaseAdmin.storage.createBucket("documents", {
    public: false,
    fileSizeLimit: 52428800, // 50 MB
    allowedMimeTypes: allowedTypes,
  });

  // Always update bucket to ensure image mime types are enabled
  await supabaseAdmin.storage.updateBucket("documents", {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: allowedTypes,
  });

  if (!error || error.message.toLowerCase().includes("already exists") || error.message.toLowerCase().includes("already been created")) {
    bucketReady = true;
  } else {
    console.warn("[storage] bucket creation warning:", error.message);
  }
}
