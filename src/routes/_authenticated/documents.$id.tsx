import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { DocumentPreview } from "@/components/workspace/DocumentPreview";
import { Button } from "@/components/ui/button";
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
  formatDocument,
  getAssetUrls,
} from "@/lib/acadformat.functions";
import {
  ACADEMIC_LEVELS,
  DOCUMENT_TYPES,
  UNIVERSITIES,
  resolveConfig,
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
  const fetchAssetUrls = useServerFn(getAssetUrls);
  const [busy, setBusy] = useState<string | null>(null);

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
  const final = doc.data?.final_document as FinalDocument | null;
  const audit = doc.data?.final_audit as
    | { passed: boolean; pageCount: number; findings: string[] }
    | null;
  const saved = doc.data?.institution as InstitutionSelection | null;

  const [selection, setSelection] = useState<InstitutionSelection>({
    university: UNIVERSITIES[0].name,
    school: UNIVERSITIES[0].schools[0].name,
    department: UNIVERSITIES[0].schools[0].departments[0],
    documentType: DOCUMENT_TYPES[0],
    level: ACADEMIC_LEVELS[0],
    configId: UNIVERSITIES[0].schools[0].configId,
  });

  useEffect(() => {
    if (saved) setSelection(saved);
  }, [saved]);

  const university = UNIVERSITIES.find((u) => u.name === selection.university) ?? UNIVERSITIES[0];
  const school = university.schools.find((s) => s.name === selection.school) ?? university.schools[0];
  const config = useMemo(
    () => resolveConfig(selection),
    [selection.configId, selection.documentType],
  );

  const assets = useQuery({
    queryKey: ["assets", id, doc.data?.final_document ? "ready" : "none"],
    enabled: Boolean(doc.data?.final_document),
    queryFn: () => fetchAssetUrls({ data: { documentId: id } }),
  });

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

  async function download() {
    setBusy("export");
    try {
      const result = await runExport({ data: { documentId: id } });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl">{doc.data?.file_name ?? "Document"}</h1>
            <p className="text-sm text-muted-foreground">
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
        <Card className="mt-8 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl">1 · Understand &amp; analyse</CardTitle>
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
                <Field label="Objectives" value={understanding.objectives?.join(" · ")} />
                <Field label="Key findings" value={understanding.findings?.join(" · ")} />
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

        {/* Step 2 — Review issues */}
        {issues.data && issues.data.length > 0 && (
          <Card className="mt-8 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-2xl">2 · Review proposals</CardTitle>
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
        <Card className="mt-8 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl">3 · Institutional format</CardTitle>
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
                  setSelection({
                    ...selection,
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
                  setSelection({
                    ...selection,
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
                onChange={(value) => setSelection({ ...selection, department: value })}
              />
              <Picker
                label="Document type"
                value={selection.documentType}
                options={[...DOCUMENT_TYPES]}
                onChange={(value) => setSelection({ ...selection, documentType: value })}
              />
              <Picker
                label="Academic level"
                value={selection.level}
                options={[...ACADEMIC_LEVELS]}
                onChange={(value) => setSelection({ ...selection, level: value })}
              />
            </div>

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
          <Card className="mt-8 shadow-soft">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-2xl">4 · Verify &amp; preview</CardTitle>
                <CardDescription>
                  {audit?.pageCount} pages rebuilt ·{" "}
                  {audit?.passed ? "final check passed" : `${audit?.findings.length} item(s) to review`}
                </CardDescription>
              </div>
              <Button onClick={download} disabled={busy === "export"}>
                {busy === "export" ? "Preparing…" : "Download DOCX"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {audit && audit.findings.length > 0 && (
                <ul className="list-disc space-y-1 rounded-lg border border-border bg-secondary/40 p-4 pl-8 text-sm">
                  {audit.findings.map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              )}
              <div className="doc-canvas">
                <DocumentPreview final={final} config={config} assetUrls={assets.data?.urls ?? {}} />
              </div>
            </CardContent>
          </Card>
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