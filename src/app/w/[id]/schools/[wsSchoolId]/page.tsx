"use client";

import { SchoolLogo } from "@/components/schools/SchoolLogo";
import { Button, Chip, EmptyState, Input, Label, Modal, Select, Spinner, StatusPill, Textarea } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc, WorkspaceSchool } from "@/lib/types";
import { formatRelative, tiptapText, wordCountOf } from "@/lib/utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SchoolWorkspacePage() {
  const { wsSchoolId } = useParams<{ wsSchoolId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const router = useRouter();
  const [ws, setWs] = useState<WorkspaceSchool | null>(null);
  const [questions, setQuestions] = useState<Doc[]>([]);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [limitValue, setLimitValue] = useState("250");
  const [limitUnit, setLimitUnit] = useState<"words" | "chars">("words");
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function load() {
    const [{ data: w }, { data: q }] = await Promise.all([
      supabase.from("workspace_schools").select("*, school:schools(*)").eq("id", wsSchoolId).single(),
      supabase
        .from("documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("type", "supplemental")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);
    setWs(w as any);
    setQuestions((q ?? []).filter((d: Doc) => d.metadata.school_id === wsSchoolId));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsSchoolId]);

  async function patch(p: Partial<WorkspaceSchool>) {
    setWs((prev) => (prev ? ({ ...prev, ...p } as WorkspaceSchool) : prev));
    await supabase.from("workspace_schools").update(p).eq("id", wsSchoolId);
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase
      .from("documents")
      .insert({
        workspace_id: workspace.id,
        type: "supplemental",
        title: question.slice(0, 80),
        created_by: me.id,
        metadata: {
          school_id: wsSchoolId,
          question,
          limit_value: +limitValue || undefined,
          limit_unit: limitUnit,
        },
      })
      .select("id")
      .single();
    setAdding(false);
    setQuestion("");
    if (data) router.push(`/w/${workspace.id}/supplementals/${data.id}`);
  }

  async function removeSchool() {
    await supabase.from("workspace_schools").delete().eq("id", wsSchoolId);
    router.push(`/w/${workspace.id}/schools`);
  }

  if (!ws)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/w/${workspace.id}/schools`}
        className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← Schools
      </Link>

      <div className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <SchoolLogo school={ws.school!} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold">{ws.school!.name}</h1>
            <p className="text-sm text-ink-soft">
              {ws.school!.city}, {ws.school!.state}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ws.school!.ownership && <Chip>{ws.school!.ownership}</Chip>}
              {ws.school!.admission_rate != null && (
                <Chip>{Math.round(ws.school!.admission_rate * 100)}% admit rate</Chip>
              )}
              {ws.school!.enrollment != null && (
                <Chip>{ws.school!.enrollment.toLocaleString()} undergrads</Chip>
              )}
              {ws.school!.url && (
                <a href={ws.school!.url.startsWith("http") ? ws.school!.url : `https://${ws.school!.url}`} target="_blank" rel="noreferrer">
                  <Chip color="#175E54">Website ↗</Chip>
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={ws.status}
              onChange={(e) => patch({ status: e.target.value as any })}
              className="!w-auto"
              aria-label="Application status"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="complete">Complete</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
              Remove
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-paper-line pt-4 sm:grid-cols-3">
          {(
            [
              ["ed_deadline", "Early Decision"],
              ["ea_deadline", "Early Action"],
              ["rd_deadline", "Regular Decision"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                type="date"
                value={(ws as any)[key] ?? ""}
                onChange={(e) => patch({ [key]: e.target.value || null } as any)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Label>Notes</Label>
          <Textarea
            rows={2}
            defaultValue={ws.notes ?? ""}
            onBlur={(e) => patch({ notes: e.target.value })}
            placeholder="Why this school, interview notes, portal logins live elsewhere…"
          />
        </div>
      </div>

      {/* Supplemental questions */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
          Supplemental questions ({questions.length})
        </h2>
        <Button onClick={() => setAdding(true)}>+ Question</Button>
      </div>

      <div className="mt-3 space-y-3">
        {questions.length === 0 && (
          <EmptyState
            title="No supplemental questions yet"
            hint={`Add the prompts ${ws.school!.name} actually asks — each gets its own drafts, versions, comments, and cross-import.`}
            action={<Button onClick={() => setAdding(true)}>Add the first question</Button>}
          />
        )}
        {questions.map((q) => {
          const words = wordCountOf(q.current_content);
          return (
            <Link
              key={q.id}
              href={`/w/${workspace.id}/supplementals/${q.id}`}
              className="block rounded-card border border-paper-line bg-paper-raised p-4 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium leading-snug">{q.metadata.question || q.title}</p>
                <StatusPill status={q.status} />
              </div>
              <p className="mt-2 text-sm text-ink-soft line-clamp-2">
                {tiptapText(q.current_content).slice(0, 200) || "No draft yet."}
              </p>
              <p className="mt-2 text-[11px] text-ink-faint">
                {q.metadata.limit_value
                  ? `${q.metadata.limit_value} ${q.metadata.limit_unit ?? "words"} reference limit · `
                  : ""}
                {words} words drafted · updated {formatRelative(q.updated_at)}
              </p>
            </Link>
          );
        })}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add supplemental question">
        <form onSubmit={addQuestion} className="space-y-4">
          <div>
            <Label>The prompt (as the school words it)</Label>
            <Textarea
              autoFocus
              required
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`e.g. Why do you want to attend ${ws.school!.name}? (250 words)`}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Stated limit</Label>
              <Input type="number" min={1} value={limitValue} onChange={(e) => setLimitValue(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Unit</Label>
              <Select value={limitUnit} onChange={(e) => setLimitUnit(e.target.value as any)}>
                <option value="words">Words</option>
                <option value="chars">Characters</option>
              </Select>
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Informational only — the editor never blocks or truncates; the counter just changes color.
          </p>
          <Button type="submit" className="w-full">
            Add question
          </Button>
        </form>
      </Modal>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove school?">
        <p className="text-sm text-ink-soft">
          This removes {ws.school!.name} from your list. Its supplemental question documents are
          kept (soft-deleted docs are restorable from Settings), but they&apos;ll no longer appear here.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={removeSchool}>
            Remove school
          </Button>
        </div>
      </Modal>
    </div>
  );
}
