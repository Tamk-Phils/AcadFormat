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
    <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 font-sans">
      
      {/* Main Feed Column (Left/Center) */}
      <main className="flex-1 flex flex-col gap-6">
        <div className="glass-panel rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
            <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/20 blur-[100px] rounded-full" />
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">Your Workspace</h1>
            <p className="text-slate-300 max-w-xl text-lg font-light">
              Upload raw academic drafts to be instantly audited and strictly restructured to your institution's verified standards.
            </p>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="relative z-10 bg-white text-black hover:bg-slate-200 shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] rounded-2xl h-14 px-8 transition-all duration-300">
            {uploading ? "Uploading..." : <><Plus className="w-5 h-5 mr-2" /> New Document</>}
          </Button>
        </div>

        {/* Upload Zone */}
        <div 
          onClick={() => inputRef.current?.click()}
          className="relative group cursor-pointer overflow-hidden rounded-[2rem] border border-dashed border-white/30 glass-panel transition-all hover:glass-panel-strong hover:border-indigo-400"
        >
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center relative z-10">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-xl">
              <UploadCloud className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Drag & drop or click to upload</h3>
            <p className="text-sm text-slate-300">Supports DOCX and searchable PDF files</p>
            
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
        <div className="mt-4">
          <h2 className="text-xl font-medium text-white mb-6 flex items-center px-2">
            <Clock className="w-5 h-5 mr-3 text-slate-300" /> Recent Documents
          </h2>

          {documents.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-[2rem] glass-panel animate-pulse" />
              ))}
            </div>
          )}

          {documents.data?.length === 0 && (
            <div className="text-center py-12 rounded-[2rem] glass-panel">
              <p className="text-slate-400">Your workspace is empty. Upload a document to begin.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.data?.map((doc) => {
              const statusInfo = STATUS_LABEL[doc.status] || { label: doc.status, color: "bg-white/10 text-slate-300 border-white/20" };
              
              return (
                <div
                  key={doc.id}
                  className="group relative flex flex-col justify-between rounded-[2rem] glass-panel p-6 transition-all hover:glass-panel-strong"
                >
                  <Link
                    to="/documents/$id"
                    params={{ id: doc.id }}
                    className="absolute inset-0 z-0 rounded-[2rem]"
                  />
                  
                  <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-lg border backdrop-blur-md ${statusInfo.color}`}>
                      {statusInfo.label}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/20 -mr-2 -mt-2 text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-black/80 backdrop-blur-xl border-white/10 text-white rounded-xl">
                        <DropdownMenuItem asChild className="hover:bg-white/10 focus:bg-white/10 rounded-lg cursor-pointer">
                          <Link to="/documents/$id" params={{ id: doc.id }}>
                            <FileDown className="w-4 h-4 mr-2" /> Open Editor
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
                          disabled={deletingId === doc.id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 focus:text-red-300 focus:bg-red-500/20 cursor-pointer mt-1 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-indigo-300" />
                      </div>
                      <h3 className="font-medium text-white truncate text-lg pr-2" title={doc.file_name}>
                        {doc.file_name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 pl-14">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Right Sidebar Column */}
      <aside className="w-full md:w-80 flex flex-col gap-6 shrink-0 hidden lg:flex">
        <div className="glass-panel rounded-[2rem] p-6">
          <h3 className="text-lg font-medium text-white mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Total Documents</span>
              <span className="text-white font-semibold bg-white/10 px-3 py-1 rounded-full">{documents.data?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Active Plan</span>
              <span className="text-indigo-300 font-semibold bg-indigo-500/20 px-3 py-1 rounded-full">Pro</span>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6 flex-1">
          <h3 className="text-lg font-medium text-white mb-4">Latest Updates</h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white mb-1">AST Engine Upgraded</p>
                <p className="text-xs text-slate-400 leading-relaxed">Document analysis is now fully deterministic with 100% precision on structural extraction.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white mb-1">COLTECH Standards</p>
                <p className="text-xs text-slate-400 leading-relaxed">Added strict verification rules for all College of Technology dissertation submissions.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

    </div>
  );
}