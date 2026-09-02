import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { FileText, UploadCloud, Trash2, Clock, MoreVertical, FileDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Workspace | AcadFormat" },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, { label: string, color: string }> = {
  uploaded: { label: "Awaiting analysis", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  analyzing: { label: "Analysing", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  analyzed: { label: "Analysed", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  formatted: { label: "Formatted", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, status, created_at, institution, storage_path")
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

  async function handleDeleteDocument(docId: string, storagePath?: string) {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) {
      return;
    }

    setDeletingId(docId);
    try {
      if (storagePath) {
        await supabase.storage.from("documents").remove([storagePath]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", docId);
      if (error) throw error;

      toast.success("Document deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-50 font-sans">
      <SiteHeader user={user} />
      
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-[20%] w-[50%] h-[30%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">Your Workspace</h1>
            <p className="text-slate-400 max-w-xl">
              Upload raw academic drafts to be instantly audited and strictly restructured to your institution's verified standards.
            </p>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] rounded-xl h-12 px-6 transition-all duration-300">
            {uploading ? "Uploading..." : <><Plus className="w-4 h-4 mr-2" /> New Document</>}
          </Button>
        </div>

        {/* Upload Zone */}
        <div 
          onClick={() => inputRef.current?.click()}
          className="relative group cursor-pointer overflow-hidden rounded-3xl border border-dashed border-white/20 bg-white/5 backdrop-blur-md transition-all hover:bg-white/10 hover:border-indigo-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center relative z-10">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <UploadCloud className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Drag & drop or click to upload</h3>
            <p className="text-sm text-slate-400">Supports DOCX and searchable PDF files</p>
            
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
          </div>
        </div>

        {/* History Grid */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
            <Clock className="w-5 h-5 mr-3 text-slate-400" /> Recent Documents
          </h2>

          {documents.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
              ))}
            </div>
          )}

          {documents.data?.length === 0 && (
            <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.02]">
              <p className="text-slate-500">Your workspace is empty. Upload a document to begin.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.data?.map((doc) => {
              const statusInfo = STATUS_LABEL[doc.status] || { label: doc.status, color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
              
              return (
                <div
                  key={doc.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/[0.08] hover:border-indigo-500/30"
                >
                  <Link
                    to="/documents/$id"
                    params={{ id: doc.id }}
                    className="absolute inset-0 z-0 rounded-2xl"
                  />
                  
                  <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 -mr-2 -mt-2 text-slate-400">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-white/10">
                        <DropdownMenuItem asChild>
                          <Link to="/documents/$id" params={{ id: doc.id }} className="cursor-pointer">
                            <FileDown className="w-4 h-4 mr-2" /> Open Editor
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
                          disabled={deletingId === doc.id}
                          className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-400/10 cursor-pointer mt-1"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-8 h-8 text-indigo-400/70" />
                      <h3 className="font-medium text-white truncate text-lg pr-4" title={doc.file_name}>
                        {doc.file_name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 pl-11">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}