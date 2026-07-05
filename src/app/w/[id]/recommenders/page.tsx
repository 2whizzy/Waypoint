"use client";

import { Avatar, Button, EmptyState, Input, Label, Modal, Select, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc, RecommenderMeta } from "@/lib/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PIPELINE: RecommenderMeta["pipeline"][] = ["not_asked", "asked", "confirmed", "submitted"];
const PIPELINE_LABELS: Record<string, string> = {
  not_asked: "Not yet asked",
  asked: "Asked",
  confirmed: "Confirmed",
  submitted: "Submitted",
};

export default function RecommendersPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("type", "recommender")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setDocs(data ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`recs:${workspace.id}`)
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("documents").insert({
      workspace_id: workspace.id,
      type: "recommender",
      title: name,
      created_by: me.id,
      metadata: { relationship, email, pipeline: "not_asked" },
    });
    setAdding(false);
    setName("");
    setRelationship("");
    setEmail("");
    load();
  }

  async function setPipeline(doc: Doc, pipeline: string) {
    await supabase
      .from("documents")
      .update({ metadata: { ...doc.metadata, pipeline } })
      .eq("id", doc.id);
    load();
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
          <h1 className="font-display text-2xl font-semibold">Recommenders</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Track who&apos;s writing for you, from first ask to submitted letter.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Recommender</Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          title="No recommenders yet"
          hint="Add teachers, counselors, coaches — anyone writing a letter. Each gets a brag sheet with comments, versions, and attachments."
          action={<Button onClick={() => setAdding(true)}>Add a recommender</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d, i) => {
            const meta = d.metadata as RecommenderMeta;
            const stage = PIPELINE.indexOf(meta.pipeline ?? "not_asked");
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <Avatar profile={{ display_name: d.title, color: "#3E5C8A", avatar_url: null }} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/w/${workspace.id}/recommenders/${d.id}`} className="block truncate font-semibold hover:text-pine-700">
                      {d.title}
                    </Link>
                    <p className="truncate text-xs text-ink-faint">
                      {[meta.relationship, meta.email].filter(Boolean).join(" · ") || "Add contact details"}
                    </p>
                  </div>
                  <StatusPill status={meta.pipeline ?? "not_asked"} />
                </div>

                {/* Pipeline */}
                <div className="mt-4 flex items-center gap-1" role="group" aria-label="Status pipeline">
                  {PIPELINE.map((p, idx) => (
                    <button
                      key={p}
                      onClick={() => setPipeline(d, p!)}
                      title={PIPELINE_LABELS[p!]}
                      className="group flex flex-1 flex-col items-center gap-1"
                    >
                      <span
                        className={`h-1.5 w-full rounded-full transition-colors ${
                          idx <= stage ? "bg-pine-500" : "bg-paper-sunken group-hover:bg-pine-200"
                        }`}
                      />
                      <span className="text-[10px] text-ink-faint">{PIPELINE_LABELS[p!]}</span>
                    </button>
                  ))}
                </div>

                <Link
                  href={`/w/${workspace.id}/recommenders/${d.id}`}
                  className="mt-4 inline-block text-xs font-medium text-pine-600 hover:underline"
                >
                  Open brag sheet →
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New recommender">
        <form onSubmit={add} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ms. Rivera" />
          </div>
          <div>
            <Label>Relationship</Label>
            <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. AP English teacher, 11th grade" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">
            Add recommender
          </Button>
        </form>
      </Modal>
    </div>
  );
}
