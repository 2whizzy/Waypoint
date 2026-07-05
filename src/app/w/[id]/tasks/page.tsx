"use client";

import { Avatar, Button, EmptyState, Input, Label, Modal, Select, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc, Task, TaskRequest, WorkspaceSchool } from "@/lib/types";
import { cn, formatDate, isoDay } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface Suggestion {
  title: string;
  task_type: string;
  related_document_id?: string;
}

export default function TasksPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me, members, memberById } = useWorkspace();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [creating, setCreating] = useState(false);
  const [asRequest, setAsRequest] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assigned_to: "",
    due_date: "",
    estimated_minutes: "",
  });

  async function load() {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("task_requests").select("*").eq("workspace_id", workspace.id).eq("status", "pending"),
    ]);
    setTasks(t ?? []);
    setRequests(r ?? []);
  }

  async function computeSuggestions() {
    const [{ data: rawDocs }, { data: schools }, { data: versions }, { data: comments }] =
      await Promise.all([
        supabase.from("documents").select("id, type, title, status, metadata").eq("workspace_id", workspace.id).is("deleted_at", null),
        supabase.from("workspace_schools").select("*, school:schools(name)").eq("workspace_id", workspace.id),
        supabase.from("document_versions").select("id, document_id"),
        supabase.from("comments").select("id, document_id"),
      ]);
    const docs = (rawDocs ?? []) as unknown as Doc[];
    const s: Suggestion[] = [];
    const vCount = (id: string) => (versions ?? []).filter((v) => v.document_id === id).length;
    const cCount = (id: string) => (comments ?? []).filter((c) => c.document_id === id).length;

    const essay = (docs ?? []).find((d: Doc) => d.type === "essay");
    if (essay) {
      if (vCount(essay.id) === 0) s.push({ title: "Write essay draft 1", task_type: "essay", related_document_id: essay.id });
      else if (cCount(essay.id) < 2) s.push({ title: "Get 2 comments on the essay", task_type: "essay", related_document_id: essay.id });
      else if (essay.status !== "final") s.push({ title: "Finalize the personal essay", task_type: "essay", related_document_id: essay.id });
    } else {
      s.push({ title: "Start the personal essay", task_type: "essay" });
    }

    (docs ?? [])
      .filter((d: Doc) => d.type === "activity" && d.status !== "final")
      .slice(0, 5)
      .forEach((d: Doc, i: number) => {
        if (!d.metadata.description)
          s.push({ title: `Write the 150-char description for “${d.title}”`, task_type: "activity", related_document_id: d.id });
        else s.push({ title: `Finalize activity “${d.title}”`, task_type: "activity", related_document_id: d.id });
      });

    (docs ?? [])
      .filter((d: Doc) => d.type === "recommender" && (d.metadata.pipeline ?? "not_asked") === "not_asked")
      .forEach((d: Doc) => s.push({ title: `Ask ${d.title} for a recommendation`, task_type: "recommender", related_document_id: d.id }));

    ((schools as any[]) ?? [])
      .filter((ws: WorkspaceSchool) => ws.status !== "complete")
      .forEach((ws: any) => {
        const hasQuestions = (docs ?? []).some((d: Doc) => d.type === "supplemental" && d.metadata.school_id === ws.id);
        if (!hasQuestions)
          s.push({ title: `Add supplemental questions for ${ws.school.name}`, task_type: "supplemental" });
      });

    if ((docs ?? []).filter((d: Doc) => d.type === "activity").length === 0)
      s.push({ title: "Add your first 5 activities", task_type: "activity" });

    setSuggestions(s.slice(0, 8));
  }

  useEffect(() => {
    load();
    computeSuggestions();
    const channel = supabase
      .channel(`tasks:${workspace.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspace.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_requests", filter: `workspace_id=eq.${workspace.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function addSuggestion(s: Suggestion) {
    await supabase.from("tasks").insert({
      workspace_id: workspace.id,
      title: s.title,
      task_type: s.task_type,
      assigned_to: me.id,
      assigned_by: me.id,
      related_document_id: s.related_document_id ?? null,
    });
    setSuggestions((prev) => prev.filter((x) => x !== s));
    load();
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      workspace_id: workspace.id,
      title: form.title,
      task_type: "custom",
      due_date: form.due_date || null,
      estimated_minutes: form.estimated_minutes ? +form.estimated_minutes : null,
    };
    if (asRequest && form.assigned_to && form.assigned_to !== me.id) {
      await supabase.from("task_requests").insert({
        ...base,
        from_user: me.id,
        to_user: form.assigned_to,
      });
      await supabase.from("notifications").insert({
        workspace_id: workspace.id,
        user_id: form.assigned_to,
        kind: "task_request",
        body: `${me.display_name} proposed a task for you: “${form.title}”`,
      });
    } else {
      await supabase.from("tasks").insert({
        ...base,
        assigned_to: form.assigned_to || me.id,
        assigned_by: me.id,
      });
    }
    setCreating(false);
    setForm({ title: "", assigned_to: "", due_date: "", estimated_minutes: "" });
    load();
  }

  async function respondRequest(r: TaskRequest, accept: boolean) {
    await supabase.from("task_requests").update({ status: accept ? "accepted" : "declined" }).eq("id", r.id);
    if (accept) {
      await supabase.from("tasks").insert({
        workspace_id: workspace.id,
        title: r.title,
        task_type: r.task_type,
        assigned_to: r.to_user,
        assigned_by: r.from_user,
        due_date: r.due_date,
        estimated_minutes: r.estimated_minutes,
      });
    }
    await supabase.from("notifications").insert({
      workspace_id: workspace.id,
      user_id: r.from_user,
      kind: "task_request",
      body: `${me.display_name} ${accept ? "accepted" : "declined"} your task request “${r.title}”`,
    });
    load();
  }

  async function cycleStatus(t: Task) {
    const next = t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
    await supabase
      .from("tasks")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    load();
  }

  if (tasks === null)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  const today = isoDay();
  const mineToday = tasks.filter((t) => t.assigned_to === me.id && t.status !== "done" && t.due_date === today);
  const overdue = tasks.filter((t) => t.status === "missed" || (t.status !== "done" && t.due_date && t.due_date < today));
  const open = tasks.filter((t) => t.status !== "done" && !overdue.includes(t) && !mineToday.includes(t));
  const done = tasks.filter((t) => t.status === "done");
  const incoming = requests.filter((r) => r.to_user === me.id);
  const outgoing = requests.filter((r) => r.from_user === me.id);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tasks</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Who&apos;s doing what, by when — visible to everyone.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Task</Button>
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="mb-6 rounded-card border border-marigold-300 bg-marigold-100/40 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-marigold-600">
            Task requests for you
          </h2>
          {incoming.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <Avatar profile={memberById(r.from_user)} size={22} />
              <span className="text-sm">
                <strong>{memberById(r.from_user)?.display_name}</strong> asks: “{r.title}”
                {r.due_date && <span className="text-ink-faint"> · due {formatDate(r.due_date)}</span>}
                {r.estimated_minutes && <span className="text-ink-faint"> · ~{r.estimated_minutes}m</span>}
              </span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => respondRequest(r, true)}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" onClick={() => respondRequest(r, false)}>
                  Decline
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}
      {outgoing.length > 0 && (
        <p className="mb-6 text-xs text-ink-faint">
          {outgoing.length} request{outgoing.length > 1 ? "s" : ""} you sent are awaiting a response.
        </p>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
            Suggested next steps (from the state of the application)
          </h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => addSuggestion(s)}
                className="rounded-full border border-dashed border-pine-300 bg-pine-50 px-3 py-1.5 text-xs font-medium text-pine-700 transition-colors hover:bg-pine-100"
              >
                + {s.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Task groups */}
      {[
        ["Due today (you)", mineToday, false],
        ["Overdue / missed", overdue, true],
        ["Open", open, false],
        ["Done", done, false],
      ].map(([label, group, danger]) => {
        const items = group as Task[];
        if (!items.length && label !== "Open") return null;
        return (
          <section key={label as string} className="mb-8">
            <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.15em]", danger ? "text-clay-600" : "text-ink-faint")}>
              {label as string} ({items.length})
            </h2>
            {items.length === 0 ? (
              <EmptyState title="Nothing here" hint="Add a task or grab a suggestion above." />
            ) : (
              <div className="space-y-1.5">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border bg-paper-raised px-3 py-2.5",
                      danger ? "border-clay-400/40" : "border-paper-line"
                    )}
                  >
                    <button
                      onClick={() => cycleStatus(t)}
                      aria-label={`Status: ${t.status}. Click to advance.`}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors",
                        t.status === "done"
                          ? "border-pine-600 bg-pine-600 text-white"
                          : t.status === "in_progress"
                            ? "border-marigold-400 text-marigold-500"
                            : t.status === "missed"
                              ? "border-clay-600 text-clay-600"
                              : "border-paper-line hover:border-pine-400"
                      )}
                    >
                      {t.status === "done" ? "✓" : t.status === "in_progress" ? "…" : t.status === "missed" ? "!" : ""}
                    </button>
                    <span className={cn("min-w-0 flex-1 text-sm", t.status === "done" && "text-ink-faint line-through")}>
                      {t.title}
                    </span>
                    {t.estimated_minutes && <span className="text-[11px] text-ink-faint">~{t.estimated_minutes}m</span>}
                    {t.due_date && (
                      <span className={cn("text-[11px]", t.due_date < today && t.status !== "done" ? "font-semibold text-clay-600" : "text-ink-faint")}>
                        {formatDate(t.due_date)}
                      </span>
                    )}
                    <Avatar profile={memberById(t.assigned_to)} size={22} />
                    <StatusPill status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title={asRequest ? "Propose a task" : "New task"}>
        <form onSubmit={submitForm} className="space-y-4">
          <div>
            <Label>What needs to happen?</Label>
            <Input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>{asRequest ? "Ask" : "Assign to"}</Label>
            <Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} required={asRequest}>
              <option value="">{asRequest ? "Choose someone…" : `Me (${me.display_name})`}</option>
              {members
                .filter((m) => !asRequest || m.user_id !== me.id)
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.display_name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="flex-1">
              <Label>Estimate (min)</Label>
              <Input type="number" min={5} step={5} value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asRequest} onChange={(e) => setAsRequest(e.target.checked)} className="h-4 w-4 accent-pine-600" />
            Send as a request (they accept or decline before it becomes a tracked task)
          </label>
          <Button type="submit" className="w-full">
            {asRequest ? "Send request" : "Create task"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
