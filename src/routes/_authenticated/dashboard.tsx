import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My documents — AcadFormat" },
      { name: "description", content: "Upload, analyse and format your academic documents." },
      { property: "og:title", content: "My documents — AcadFormat" },
      { property: "og:description", content: "Your AcadFormat document workspace and history." },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Awaiting analysis",
  analyzing: "Analysing",
  analyzed: "Analysed",
  formatted: "Formatted",
  failed: "Failed",
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, status, created_at, institution")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      toast.error("Upload a .docx or .pdf file.");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("documents").upload(path, file);
      if (up.error) throw up.error;
      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: ext,
          storage_path: path,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      navigate({ to: "/documents/$id", params: { id: data.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-4xl">My documents</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Upload a dissertation, thesis, project or internship report. AcadFormat reads it,
          audits it against your institution's verified rules, and rebuilds it page by page.
        </p>

        <Card className="mt-8 border-dashed shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <UploadCloud className="size-10 text-accent" />
            <div>
              <p className="font-medium">Drop in your DOCX or PDF</p>
              <p className="text-sm text-muted-foreground">
                Text-based files only — scanned PDFs cannot be read.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Choose file"}
            </Button>
          </CardContent>
        </Card>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-2xl">History</h2>
          {documents.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {documents.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          )}
          {documents.data?.map((doc) => (
            <Link
              key={doc.id}
              to="/documents/$id"
              params={{ id: doc.id }}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <span>
                  <span className="block font-medium">{doc.file_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleString()}
                  </span>
                </span>
              </span>
              <Badge variant={doc.status === "failed" ? "destructive" : "secondary"}>
                {STATUS_LABEL[doc.status] ?? doc.status}
              </Badge>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}