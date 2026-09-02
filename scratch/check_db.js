import { createClient } from "@supabase/supabase-js";

const url = "https://glkxiewgupdroxljpcmb.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsa3hpZXdndXBkcm94bGpwY21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTA4NzAsImV4cCI6MjA5MDQyNjg3MH0.rMOb0E1yiUEH2BfQxBC07Q4ueDrMTFjKmM9keG-kX9o";

const supabase = createClient(url, key);

async function check() {
  const { data: docs, error: docsErr } = await supabase.from("documents").select("user_id, created_at, file_name").limit(10);
  console.log("Docs:", docs, docsErr);

  const { data: reviews, error: revErr } = await supabase.from("product_reviews").select("*").limit(10);
  console.log("Reviews:", reviews, revErr);

  const { data: profiles, error: profErr } = await supabase.from("profiles").select("*").limit(10);
  console.log("Profiles:", profiles, profErr);
}

check();
