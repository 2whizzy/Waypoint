"use client";

import { Button, EmptyState, Input, Label, Modal, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc } from "@/lib/types";
import { formatRelative, wordCountOf } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function EssayLibraryPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Doc[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("type", "essay")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setDrafts((data as any) ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`essays:${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `workspace_id=eq.${workspace.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("documents")
      .insert({
        workspace_id: workspace.id,
        type: "essay",
        title: newTitle.trim() || "Untitled draft",
        created_by: me.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return;
    setCreating(false);
    setNewTitle("");
    router.push(`/w/${workspace.id}/essay/${data.id}`);
  }

  async function trashDraft(d: Doc) {
    await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", d.id);
    load();
  }

  if (drafts === null)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Personal essay</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Every draft is its own document with comments and version history. Open one to write.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New draft</Button>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          hint="Start your first draft — you can spin up alternates any time and keep them side by side."
          action={<Button onClick={() => setCreating(true)}>Start a draft</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((d, i) => {
            const words = wordCountOf(d.current_content);
            const preview = previewText(d);
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group relative"
              >
                <Link
                  href={`/w/${workspace.id}/essay/${d.id}`}
                  className="flex h-full flex-col rounded-card border border-paper-line bg-paper-raised p-4 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold" title={d.title}>
                      {d.title}
                    </p>
                    <StatusPill status={d.status} />
                  </div>
                  <p className="mt-2 flex-1 text-sm text-ink-soft line-clamp-3">
                    {preview || <span className="italic text-ink-faint">Empty draft</span>}
                  </p>
                  <p className="mt-3 text-[11px] text-ink-faint">
                    {words} words · edited {formatRelative(d.updated_at)}
                  </p>
                </Link>
                <button
                  onClick={() => trashDraft(d)}
                  title="Move draft to trash (restorable in Settings)"
                  aria-label={`Delete draft ${d.title}`}
                  className="absolute right-2 top-2 hidden rounded-md bg-paper-raised/90 px-1.5 py-0.5 text-xs text-clay-600 shadow-card hover:bg-clay-600 hover:text-white group-hover:block"
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        650 words is the Common App reference limit — counters flag it but never block or cut your
        writing. Deleted drafts can be restored from Settings → Trash.
      </p>

      <Modal open={creating} onClose={() => setCreating(false)} title="New essay draft">
        <form onSubmit={createDraft} className="space-y-4">
          <div>
            <Label>Draft title</Label>
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Draft 1 — the robotics story"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create and open"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function previewText(d: Doc): string {
  try {
    const walk = (node: any): string => node?.text ?? (node?.content ?? []).map(walk).join(" ");
    return walk(d.current_content).trim().slice(0, 220);
  } catch {
    return "";
  }
}
