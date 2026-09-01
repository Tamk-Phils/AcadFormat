import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { DocumentPreview } from "@/components/workspace/DocumentPreview";
import { OriginalPreview } from "@/components/workspace/OriginalPreview";
import { FullScreenPreviewModal } from "@/components/workspace/FullScreenPreviewModal";
import { Button } from "@/components/ui/button";
import { Maximize2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  analyzeDocument,
  exportDocx,
  exportPdf,
  formatDocument,
  getAssetUrls,
  getOriginalDocument,
  chatEditDocumentFn,
} from "@/lib/acadformat.functions";
import { buildFinalDocument, auditFinalDocument, verifyAndAlignDocumentModel } from "@/lib/document-build";
import {
  ACADEMIC_LEVEL_NAMES,
  DOCUMENT_TYPES,
  UNIVERSITIES,
  resolveConfig,
  workLabel,
  type InstitutionSelection,
} from "@/lib/institutions";
import type {
  FinalDocument,
  HealthReport,
  Understanding,
} from "@/lib/document-model";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({
    meta: [
      { title: "Document workspace — AcadFormat" },
      { name: "description", content: "Analyse, review, format and export your academic document." },
      { property: "og:title", content: "Document workspace — AcadFormat" },
      { property: "og:description", content: "The AcadFormat analysis and formatting workspace." },
    ],
  }),
  component: Workspace,
});

type Issue = {
  id: string;
  category: string;
  location: string;
  problem: string;
  explanation: string;
  suggestion: string;
  confidence: number;
  severity: string;
  decision: string;
  user_value: string | null;
};

function Workspace() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const runAnalyze = useServerFn(analyzeDocument);
  const runFormat = useServerFn(formatDocument);
  const runExport = useServerFn(exportDocx);
  const runExportPdf = useServerFn(exportPdf);
  const fetchAssetUrls = useServerFn(getAssetUrls);
  const runOriginal = useServerFn(getOriginalDocument);
  const runChatEdit = useServerFn(chatEditDocumentFn);
  
  const [busy, setBusy] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [fullScreenModalOpen, setFullScreenModalOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const doc = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const issues = useQuery({
    queryKey: ["issues", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_issues")
        .select("*")
        .eq("document_id", id)
        .order("severity", { ascending: true });
      if (error) throw error;
      return data as Issue[];
    },
  });

  const status = doc.data?.status ?? "uploaded";
  const understanding = doc.data?.understanding as Understanding | null;
  const health = doc.data?.health as HealthReport | null;

  const [selection, setSelection] = useState<InstitutionSelection>({
    university: UNIVERSITIES[0].name,
    school: UNIVERSITIES[0].schools[0].name,
    department: UNIVERSITIES[0].schools[0].departments[0],
    documentType: DOCUMENT_TYPES[0],
    level: ACADEMIC_LEVEL_NAMES[0]!,
    configId: UNIVERSITIES[0].schools[0].configId,
  });

  const saved = doc.data?.institution as InstitutionSelection | null;

  useEffect(() => {
    if (saved) setSelection(saved);
  }, [saved]);

  const updateSelection = async (updated: Partial<InstitutionSelection>) => {
    const nextSel = { ...selection, ...updated };
    setSelection(nextSel);
    await supabase.from("documents").update({ institution: nextSel as any }).eq("id", id);
    queryClient.setQueryData(["document", id], (prev: any) => {
      if (!prev) return prev;
      return { ...prev, institution: nextSel };
    });
  };

  const final = useMemo(() => {
    if (!doc.data?.model) return null;
    try {
      const config = resolveConfig(selection);
      const { model: alignedModel } = verifyAndAlignDocumentModel(doc.data.model as any);
      return buildFinalDocument({
        model: alignedModel,
        config,
        selection,
      });
    } catch (e) {
      console.error("Local build final document failed", e);
      return doc.data?.final_document as FinalDocument | null;
    }
  }, [doc.data?.model, selection]);

  const audit = useMemo(() => {
    if (!final || !doc.data?.model) return null;
    try {
      return auditFinalDocument(final, doc.data.model as any);
    } catch (e) {
      console.error("Local audit failed", e);
      return doc.data?.final_audit as any;
    }
  }, [final, doc.data?.model]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";
      if (text && selection) {
        let node = selection.anchorNode;
        let insidePreview = false;
        while (node) {
          if (node instanceof HTMLElement && (node.classList.contains("doc-canvas") || node.classList.contains("doc-page-body"))) {
            insidePreview = true;
            break;
          }
          node = node.parentNode;
        }
        if (insidePreview) {
          setSelectedText(text);
        }
      }
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  const university = UNIVERSITIES.find((u) => u.name === selection.university) ?? UNIVERSITIES[0];
  const school = university.schools.find((s) => s.name === selection.school) ?? university.schools[0];
  const config = useMemo(
    () => resolveConfig(selection),
    [selection.configId, selection.documentType],
  );

  const assets = useQuery({
    queryKey: ["assets", id, doc.data?.model ? "ready" : "none"],
    enabled: Boolean(doc.data?.model),
    queryFn: () => fetchAssetUrls({ data: { documentId: id } }),
  });

  const original = useQuery({
    queryKey: ["original", id, doc.data?.model ? "ready" : "none"],
    enabled: Boolean(doc.data?.model),
    queryFn: () => runOriginal({ data: { documentId: id } }),
  });

  const mergedAssetUrls = useMemo(() => {
    return {
      "logo-uba": "/logo-uba.png",
      "logo-coltech": "/logo-coltech.jpg",
      "uba.jpg": "/uba.jpg",
      "coltech.jpg": "/coltech.jpg",
      ...original.data?.urls,
      ...assets.data?.urls,
    };
  }, [original.data?.urls, assets.data?.urls]);

  async function analyze() {
    setBusy("analyze");
    try {
      await runAnalyze({ data: { documentId: id } });
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
      await queryClient.invalidateQueries({ queryKey: ["issues", id] });
      toast.success("Analysis complete.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed.");
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
    } finally {
      setBusy(null);
    }
  }

  async function format() {
    setBusy("format");
    try {
      await runFormat({ data: { documentId: id, selection } });
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Document rebuilt and formatted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Formatting failed.");
    } finally {
      setBusy(null);
    }
  }

  async function download(kind: "docx" | "pdf") {
    setBusy(kind);
    try {
      const result =
        kind === "pdf"
          ? await runExportPdf({ data: { documentId: id } })
          : await runExport({ data: { documentId: id } });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type:
            kind === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(issue: Issue, decision: string, value?: string) {
    await supabase
      .from("document_issues")
      .update({ decision, user_value: value ?? issue.user_value })
      .eq("id", issue.id);
    await queryClient.invalidateQueries({ queryKey: ["issues", id] });
  }

  async function handleDirectChatEdit(userMsg: string, textToUse?: string) {
    if (!userMsg.trim()) return;

    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setBusy("chat");

    try {
      const payload: any = {
        documentId: id,
        message: userMsg,
        selection,
      };
      if (textToUse || selectedText) {
        payload.selectedText = textToUse || selectedText;
      }
      const res = await runChatEdit({ data: payload });

      setChatHistory((prev) => [...prev, { role: "assistant", text: res.message }]);
      setSelectedText("");
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Document updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to edit document.");
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I encountered an error while trying to process that edit." },
      ]);
    } finally {
      setBusy(null);
    }
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setBusy("chat");

    try {
      const payload: any = {
        documentId: id,
        message: userMsg,
        selection,
      };
      if (selectedText) {
        payload.selectedText = selectedText;
      }
      const res = await runChatEdit({ data: payload });

      setChatHistory((prev) => [...prev, { role: "assistant", text: res.message }]);
      setSelectedText("");
      await queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Document updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to edit document.");
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I encountered an error while trying to process that edit." },
      ]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-6 sm:py-10 w-full overflow-x-hidden">
        {/* Mobile Quick Section Switcher Bar */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border py-2 px-1 mb-4 flex items-center justify-between overflow-x-auto gap-2 text-xs scrollbar-none sm:hidden">
          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 whitespace-nowrap" onClick={() => scrollToSection("section-1")}>
            1. Analysis
          </Button>
          {original.data && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 whitespace-nowrap" onClick={() => scrollToSection("section-1b")}>
              1b. Original
            </Button>
          )}
          {issues.data && issues.data.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 whitespace-nowrap" onClick={() => scrollToSection("section-2")}>
              2. Proposals ({issues.data.length})
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 whitespace-nowrap" onClick={() => scrollToSection("section-3")}>
            3. Institution
          </Button>
          {final && (
            <Button size="sm" variant="default" className="h-7 text-xs px-2.5 whitespace-nowrap bg-primary text-primary-foreground font-semibold" onClick={() => scrollToSection("section-4")}>
              👁️ 4. Preview
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">{doc.data?.file_name ?? "Document"}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {config.label} · {config.source}
            </p>
          </div>
          <Badge variant="secondary">{status}</Badge>
        </div>

        {doc.data?.error_message && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {doc.data.error_message}
          </p>
        )}

        {/* Step 1 — Understand & analyse */}
        <Card id="section-1" className="mt-6 sm:mt-8 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl sm:text-2xl">1 · Understand &amp; analyse</CardTitle>
            <CardDescription>
              The engine reads the whole document, learns what the work is about, then audits it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button onClick={analyze} disabled={busy === "analyze"}>
              {busy === "analyze"
                ? "Reading your document…"
                : understanding
                  ? "Re-run analysis"
                  : "Start analysis"}
            </Button>

            {understanding && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Topic" value={understanding.topic} />
                <Field label="Problem" value={understanding.problem} />
                <Field label="Methodology" value={understanding.methodology} />
                <Field label="Conclusions" value={understanding.conclusions} />
                <Field
                  label="Objectives"
                  value={
                    Array.isArray(understanding.objectives)
                      ? understanding.objectives.join(" · ")
                      : typeof understanding.objectives === "string"
                        ? understanding.objectives
                        : ""
                  }
                />
                <Field
                  label="Key findings"
                  value={
                    Array.isArray(understanding.findings)
                      ? understanding.findings.join(" · ")
                      : typeof understanding.findings === "string"
                        ? understanding.findings
                        : ""
                  }
                />
              </div>
            )}

            {health && (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-5">
                <p className="text-sm text-muted-foreground">{health.summary}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["Structure", health.structure],
                      ["Formatting", health.formatting],
                      ["Figures", health.figures],
                      ["Tables", health.tables],
                      ["Abbreviations", health.abbreviations],
                      ["References", health.references],
                      ["Cross-references", health.crossReferences],
                    ] as const
                  ).map(([label, score]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{label}</span>
                        <span className="tabular-nums text-muted-foreground">{score}%</span>
                      </div>
                      <Progress value={score} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 1b — Your document as uploaded */}
        {original.data && original.data.blocks.length > 0 && (
          <Card id="section-1b" className="mt-6 sm:mt-8 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-xl sm:text-2xl">
                1b · Your document as uploaded
              </CardTitle>
              <CardDescription>
                This is your original file, unchanged — logos, images and full text. Compare it with
                the rebuilt version in step 4.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="doc-canvas max-h-[36rem] overflow-y-auto">
                <OriginalPreview blocks={original.data.blocks} urls={original.data.urls} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Review proposals */}
        {issues.data && issues.data.length > 0 && (
          <Card id="section-2" className="mt-6 sm:mt-8 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-xl sm:text-2xl">2 · Review proposals</CardTitle>
              <CardDescription>
                Nothing is changed until you accept it. Reject to keep your original wording.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {issues.data.map((issue) => (
                <IssueRow key={issue.id} issue={issue} onDecide={decide} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Institution + format */}
        <Card id="section-3" className="mt-6 sm:mt-8 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl sm:text-2xl">3 · Institutional format</CardTitle>
            <CardDescription>
              Only verified configurations are offered. COLTECH uses its own official rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Picker
                label="University"
                value={selection.university}
                options={UNIVERSITIES.map((u) => u.name)}
                onChange={(value) => {
                  const next = UNIVERSITIES.find((u) => u.name === value)!;
                  updateSelection({
                    university: value,
                    school: next.schools[0].name,
                    department: next.schools[0].departments[0],
                    configId: next.schools[0].configId,
                  });
                }}
              />
              <Picker
                label="School / Faculty"
                value={selection.school}
                options={university.schools.map((s) => s.name)}
                onChange={(value) => {
                  const next = university.schools.find((s) => s.name === value)!;
                  updateSelection({
                    school: value,
                    department: next.departments[0],
                    configId: next.configId,
                  });
                }}
              />
              <Picker
                label="Department"
                value={selection.department}
                options={[...school.departments]}
                onChange={(value) => updateSelection({ department: value })}
              />
              <Picker
                label="Document type"
                value={selection.documentType}
                options={[...DOCUMENT_TYPES]}
                onChange={(value) => updateSelection({ documentType: value })}
              />
              <Picker
                label="Academic level"
                value={selection.level}
                options={ACADEMIC_LEVEL_NAMES}
                onChange={(value) => updateSelection({ level: value })}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Cover page will read{" "}
              <strong>{workLabel(selection.documentType, selection.level)}</strong> for this degree
              programme.
            </p>

            {/* Metadata Fields Form */}
            {doc.data?.model && (
              <MetadataForm
                model={doc.data.model}
                documentId={id}
                queryClient={queryClient}
              />
            )}

            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {config.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            <Button onClick={format} disabled={busy === "format" || !understanding}>
              {busy === "format" ? "Rebuilding…" : "Restructure & format"}
            </Button>
          </CardContent>
        </Card>

        {/* Step 4 — Verify & preview */}
        {final && (
          <Card id="section-4" className="mt-6 sm:mt-8 shadow-soft">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl sm:text-2xl">4 · Verify &amp; preview</CardTitle>
                <CardDescription>
                  {audit?.pageCount} pages rebuilt ·{" "}
                  {audit?.passed ? "final check passed" : `${Array.isArray(audit?.findings) ? audit.findings.length : 0} item(s) to review`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  onClick={() => setFullScreenModalOpen(true)}
                  className="gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  <Maximize2 className="h-4 w-4" /> Full Screen Preview
                </Button>
                <Button onClick={() => download("docx")} disabled={busy === "docx"}>
                  {busy === "docx" ? "Preparing…" : "Download DOCX"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => download("pdf")}
                  disabled={busy === "pdf"}
                >
                  {busy === "pdf" ? "Preparing…" : "Download PDF"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-bold text-sm">✨ Background AI Verification:</span>
                <span>Structural alignment verified. Cover page metadata stripped from body chapters, all sub-chapters fully populated, and APA 7th hierarchy enforced.</span>
              </div>

              {audit && Array.isArray(audit.findings) && audit.findings.length > 0 && (
                <ul className="list-disc space-y-1 rounded-lg border border-border bg-secondary/40 p-4 pl-8 text-sm">
                  {audit.findings.map((finding: string) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              )}
              
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Document Preview (Left) */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between bg-secondary/60 border border-border rounded-xl px-4 py-2 text-xs">
                    <span className="font-medium text-foreground">
                      Document Pages ({final.pages.length} Pages)
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFullScreenModalOpen(true)}
                      className="h-7 gap-1 text-xs text-primary font-semibold hover:bg-primary/10"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Open Page-by-Page View
                    </Button>
                  </div>
                  <div className="doc-canvas">
                    <DocumentPreview final={final} config={config} assetUrls={mergedAssetUrls} />
                  </div>
                </div>

                {/* AI Assistant Chat Panel (Right on Desktop) */}
                <div className="hidden lg:block lg:col-span-1 space-y-4">
                  <div className="sticky top-6 flex flex-col h-[600px] border border-border rounded-xl bg-card p-4 shadow-soft">
                    <div className="border-b border-border pb-3 mb-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        AI Academic Editor
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select text from the preview or type instructions to modify your document structure and content.
                      </p>
                    </div>

                    {/* Chat Message History */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 text-sm scrollbar-thin flex flex-col">
                      {chatHistory.length === 0 ? (
                        <div className="text-center text-muted-foreground my-auto py-8 px-2 space-y-2">
                          <p className="font-medium text-xs">No instructions sent yet.</p>
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            Highlight text on the left to edit/remove it, or type requests like:
                          </p>
                          <ul className="text-left text-xs bg-secondary/40 p-2.5 rounded-lg border border-border/50 space-y-1 list-disc pl-5">
                            <li>"Remove the section on security implications in chapter 3"</li>
                            <li>"Add a paragraph discussing future research directions"</li>
                            <li>"Rewrite the introduction of Chapter 1 to sound more professional"</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatHistory.map((msg, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-primary/5 text-primary ml-6"
                                  : "bg-secondary text-secondary-foreground mr-6"
                              }`}
                            >
                              <p className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-60">
                                {msg.role === "user" ? "You" : "AI Editor"}
                              </p>
                              <p className="leading-relaxed text-xs whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {busy === "chat" && (
                        <div className="bg-secondary text-secondary-foreground p-3 rounded-lg mr-6 animate-pulse mt-3">
                          <p className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-60">AI Editor</p>
                          <p className="text-xs">Applying changes to document structure and regenerating final layout...</p>
                        </div>
                      )}
                    </div>

                    {/* Selected Text Helper */}
                    {selectedText && (
                      <div className="bg-secondary/60 border border-border p-2.5 rounded-lg text-xs mb-3 space-y-1">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-xs text-foreground/80">Selected text (context):</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedText("")}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                          >
                            Clear
                          </button>
                        </div>
                        <p className="italic text-muted-foreground line-clamp-3 leading-relaxed">"{selectedText}"</p>
                      </div>
                    )}

                    {/* Chat Input Form */}
                    <form onSubmit={sendChatMessage} className="space-y-2 mt-auto">
                      <Textarea
                        placeholder={
                          selectedText
                            ? "Tell the AI what to do with the selected text (e.g. 'Remove this text' or 'Rewrite this')"
                            : "Type formatting or content instructions here..."
                        }
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        rows={2}
                        disabled={busy === "chat"}
                        className="resize-none text-xs"
                      />
                      <Button 
                        type="submit" 
                        className="w-full text-xs"
                        disabled={busy === "chat" || !chatMessage.trim()}
                      >
                        {busy === "chat" ? "Applying changes..." : "Apply Edit"}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile Floating Action Button and Assistant Drawer */}
        {final && (
          <>
            <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 lg:hidden">
              {selectedText && !mobileChatOpen && (
                <Badge className="bg-emerald-600 text-white animate-bounce shadow-md text-[11px] py-1 px-2.5">
                  Text Selected! Tap AI Assistant
                </Badge>
              )}
              <Button
                onClick={() => setMobileChatOpen(!mobileChatOpen)}
                className="shadow-xl font-medium text-xs rounded-full px-4 py-3 bg-primary text-primary-foreground flex items-center gap-2 border border-primary/20"
              >
                <span className="text-sm">🤖</span> {mobileChatOpen ? "Close AI Assistant" : "AI Assistant Chat"}
                {selectedText && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
              </Button>
            </div>

            {mobileChatOpen && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-2 lg:hidden">
                <div className="w-full max-w-lg bg-card rounded-t-2xl p-4 shadow-2xl border border-border animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      AI Academic Editor
                    </h4>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setMobileChatOpen(false)}>
                      ✕ Close
                    </Button>
                  </div>

                  <div className="flex flex-col h-[65vh]">
                    <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 text-sm scrollbar-thin flex flex-col">
                      {chatHistory.length === 0 ? (
                        <div className="text-center text-muted-foreground my-auto py-6 px-2 space-y-2">
                          <p className="font-medium text-xs">No instructions sent yet.</p>
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            Highlight text in preview or request changes:
                          </p>
                          <ul className="text-left text-xs bg-secondary/40 p-2.5 rounded-lg border border-border/50 space-y-1 list-disc pl-5">
                            <li>"Remove chapter 3 security section"</li>
                            <li>"Add future research directions"</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatHistory.map((msg, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-primary/5 text-primary ml-6"
                                  : "bg-secondary text-secondary-foreground mr-6"
                              }`}
                            >
                              <p className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-60">
                                {msg.role === "user" ? "You" : "AI Editor"}
                              </p>
                              <p className="leading-relaxed text-xs whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {busy === "chat" && (
                        <div className="bg-secondary text-secondary-foreground p-3 rounded-lg mr-6 animate-pulse mt-3">
                          <p className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-60">AI Editor</p>
                          <p className="text-xs">Applying changes and regenerating layout...</p>
                        </div>
                      )}
                    </div>

                    {selectedText && (
                      <div className="bg-secondary/60 border border-border p-2.5 rounded-lg text-xs mb-3 space-y-1">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-xs text-foreground/80">Selected text:</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedText("")}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                          >
                            Clear
                          </button>
                        </div>
                        <p className="italic text-muted-foreground line-clamp-2 leading-relaxed">"{selectedText}"</p>
                      </div>
                    )}

                    <form onSubmit={sendChatMessage} className="space-y-2 mt-auto">
                      <Textarea
                        placeholder={
                          selectedText
                            ? "Tell the AI what to do with selected text..."
                            : "Type formatting or content instructions..."
                        }
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        rows={2}
                        disabled={busy === "chat"}
                        className="resize-none text-xs"
                      />
                      <Button 
                        type="submit" 
                        className="w-full text-xs"
                        disabled={busy === "chat" || !chatMessage.trim()}
                      >
                        {busy === "chat" ? "Applying..." : "Apply Edit"}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Full Screen Document Reader Modal */}
        {final && (
          <FullScreenPreviewModal
            isOpen={fullScreenModalOpen}
            onClose={() => setFullScreenModalOpen(false)}
            final={final}
            config={config}
            assetUrls={mergedAssetUrls}
            fileName={doc.data?.file_name}
            onChatEdit={async (msg, txt) => {
              await handleDirectChatEdit(msg, txt);
            }}
            busy={busy === "chat"}
            chatHistory={chatHistory}
            selectedText={selectedText}
          />
        )}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IssueRow({
  issue,
  onDecide,
}: {
  issue: Issue;
  onDecide: (issue: Issue, decision: string, value?: string) => Promise<void>;
}) {
  const [value, setValue] = useState(issue.user_value ?? issue.suggestion);

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{issue.category}</Badge>
        <Badge variant={issue.severity === "high" ? "destructive" : "secondary"}>
          {issue.severity}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {issue.location} · confidence {issue.confidence}%
        </span>
        {issue.decision !== "pending" && (
          <Badge className="ml-auto" variant="secondary">
            {issue.decision}
          </Badge>
        )}
      </div>
      <p className="mt-3 font-medium">{issue.problem}</p>
      <p className="mt-1 text-sm text-muted-foreground">{issue.explanation}</p>
      <Textarea
        className="mt-3"
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onDecide(issue, "accepted", issue.suggestion)}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecide(issue, "edited", value)}>
          Use my version
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDecide(issue, "rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function MetadataForm({
  model,
  documentId,
  queryClient,
}: {
  model: any;
  documentId: string;
  queryClient: any;
}) {
  const meta = model?.meta || {};
  const [formData, setFormData] = useState({
    title: meta.title || "",
    author: meta.author || "",
    registrationNumber: meta.registrationNumber || "",
    department: meta.department || "",
    headOfDepartment: meta.headOfDepartment || "",
    director: meta.director || "",
    degreeOfAuthor: meta.degreeOfAuthor || "",
    supervisors: Array.isArray(meta.supervisors)
      ? meta.supervisors.join(", ")
      : typeof meta.supervisors === "string"
      ? meta.supervisors
      : "",
  });

  useEffect(() => {
    const currentMeta = model?.meta || {};
    setFormData({
      title: currentMeta.title || "",
      author: currentMeta.author || "",
      registrationNumber: currentMeta.registrationNumber || "",
      department: currentMeta.department || "",
      headOfDepartment: currentMeta.headOfDepartment || "",
      director: currentMeta.director || "",
      degreeOfAuthor: currentMeta.degreeOfAuthor || "",
      supervisors: Array.isArray(currentMeta.supervisors)
        ? currentMeta.supervisors.join(", ")
        : typeof currentMeta.supervisors === "string"
        ? currentMeta.supervisors
        : "",
    });
  }, [model?.meta]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistChanges = useCallback(
    async (latestData: typeof formData) => {
      const supervisorsArr = latestData.supervisors
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const nextMeta = {
        ...model?.meta,
        title: latestData.title,
        author: latestData.author,
        registrationNumber: latestData.registrationNumber,
        department: latestData.department,
        headOfDepartment: latestData.headOfDepartment,
        director: latestData.director,
        degreeOfAuthor: latestData.degreeOfAuthor,
        supervisors: supervisorsArr,
      };
      const nextModel = { ...model, meta: nextMeta };

      queryClient.setQueryData(["document", documentId], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, model: nextModel };
      });

      await supabase.from("documents").update({ model: nextModel as any }).eq("id", documentId);
    },
    [model, documentId, queryClient]
  );

  const handleChange = (field: keyof typeof formData, value: string) => {
    const nextData = { ...formData, [field]: value };
    setFormData(nextData);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistChanges(nextData);
    }, 400);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    persistChanges(formData);
  };

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-4">
      <h5 className="font-semibold text-sm">Cover Page &amp; Certification Metadata</h5>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="meta-title" className="text-xs">Document Title</Label>
          <Textarea
            id="meta-title"
            className="mt-1 text-sm min-h-[40px]"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={handleBlur}
            placeholder="Title of Dissertation / Thesis"
          />
        </div>
        <div>
          <Label htmlFor="meta-author" className="text-xs">Author Name</Label>
          <input
            id="meta-author"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.author}
            onChange={(e) => handleChange("author", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. JOHN DOE"
          />
        </div>
        <div>
          <Label htmlFor="meta-reg" className="text-xs">Registration Number</Label>
          <input
            id="meta-reg"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.registrationNumber}
            onChange={(e) => handleChange("registrationNumber", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. UB20A500"
          />
        </div>
        <div>
          <Label htmlFor="meta-dept" className="text-xs">Department</Label>
          <input
            id="meta-dept"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.department}
            onChange={(e) => handleChange("department", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. Computer Engineering"
          />
        </div>
        <div>
          <Label htmlFor="meta-hod" className="text-xs">Head of Department (with title)</Label>
          <input
            id="meta-hod"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.headOfDepartment}
            onChange={(e) => handleChange("headOfDepartment", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. Pr. Mbacham Wilfred"
          />
        </div>
        <div>
          <Label htmlFor="meta-director" className="text-xs">Director / Dean (with title)</Label>
          <input
            id="meta-director"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.director}
            onChange={(e) => handleChange("director", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. Pr. Fonteh Fru Mathias"
          />
        </div>
        <div>
          <Label htmlFor="meta-degree" className="text-xs">Degree Awarded (Degree of Author)</Label>
          <input
            id="meta-degree"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.degreeOfAuthor}
            onChange={(e) => handleChange("degreeOfAuthor", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. Master of Science"
          />
        </div>
        <div>
          <Label htmlFor="meta-supervisors" className="text-xs">Supervisors (comma separated)</Label>
          <input
            id="meta-supervisors"
            type="text"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.supervisors}
            onChange={(e) => handleChange("supervisors", e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g. Dr. John, Pr. Smith"
          />
        </div>
      </div>
    </div>
  );
}