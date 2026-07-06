"use client";

import { Button, EmptyState, Input, Label, Modal, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc } from "@/lib/types";
import { formatRelative, tiptapText } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PRESETS = [
  { title: "Additional Information", hint: "Common App's 650-word additional info section" },
  { title: "Community Disruption / Circumstances", hint: "Context about disruptions or hardship" },
  { title: "Arts Supplement", hint: "Portfolio notes, repertoire lists, links" },
  { title: "Disability / Health Context", hint: "Context you want colleges to understand" },
];

export default function ExtrasPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("type", "extra")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setDocs(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function add(t: string) {
    const { data } = await supabase
      .from("documents")
      .insert({ workspace_id: workspace.id, type: "extra", title: t, created_by: me.id })
      .select("id")
      .single();
    if (data) router.push(`/w/${workspace.id}/extras/${data.id}`);
  }

  if (docs === null)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Extras &amp; Context</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Additional information, supplements, and context — each with full versions and comments.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Document</Button>
      </div>

      {docs.length === 0 ? (
        <div>
          <p className="mb-4 text-sm text-ink-soft">Start from a common section:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                onClick={() => add(p.title)}
                className="rounded-card border border-dashed border-paper-line bg-paper-raised/60 p-5 text-left transition-colors hover:border-pine-300 hover:bg-paper-raised"
              >
                <p className="font-semibold">{p.title}</p>
                <p className="mt-1 text-xs text-ink-faint">{p.hint}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/w/${workspace.id}/extras/${d.id}`}
                className="block h-full rounded-card border border-paper-line bg-paper-raised p-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{d.title}</p>
                  <StatusPill status={d.status} />
                </div>
                <p className="mt-2 text-sm text-ink-soft line-clamp-3">
                  {tiptapText(d.current_content).slice(0, 180) || "Empty — start writing."}
                </p>
                <p className="mt-3 text-[11px] text-ink-faint">Updated {formatRelative(d.updated_at)}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New extra document">
        <div className="mb-4 space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.title}
              onClick={() => add(p.title)}
              className="block w-full rounded-lg border border-paper-line px-4 py-2.5 text-left text-sm hover:border-pine-300"
            >
              <span className="font-medium">{p.title}</span>
              <span className="block text-xs text-ink-faint">{p.hint}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add(title.trim());
          }}
        >
          <Label>Or a custom document</Label>
          <div className="flex gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title…" />
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
