"use client";

import { Button, Chip, EmptyState, Input, Modal, Select, Spinner, StatusPill, Label } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_CATEGORIES, type Doc } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const CATEGORY_ICONS: Record<string, string> = {
  Athletics: "🏃",
  Music: "🎵",
  Art: "🎨",
  "Community Service (Volunteer)": "🤝",
  "Work (Paid)": "💼",
  Research: "🔬",
  Robotics: "🤖",
  "Theater/Drama": "🎭",
  "Debate/Speech": "🗣",
  "Student Govt./Politics": "🏛",
  "Journalism/Publication": "📰",
  "Science/Math": "🧮",
  "Computer/Technology": "💻",
};

function iconFor(category?: string) {
  if (!category) return "▤";
  const hit = Object.entries(CATEGORY_ICONS).find(([k]) => category.startsWith(k.split(":")[0]));
  return hit?.[1] ?? "▤";
}

export default function ActivitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [view, setView] = useState<"list" | "cards">("list");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>(ACTIVITY_CATEGORIES[0]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("type", "activity")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });
    setDocs(data ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`activities:${workspace.id}`)
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

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    (docs ?? []).forEach((d) =>
      (d.metadata.tags ?? []).forEach((t: any) => map.set(t.label, t.color))
    );
    return Array.from(map.entries()).map(([label, color]) => ({ label, color }));
  }, [docs]);

  const filtered = useMemo(() => {
    return (docs ?? []).filter((d) => {
      if (query && !`${d.title} ${d.metadata.position ?? ""} ${d.metadata.organization ?? ""} ${d.metadata.description ?? ""}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (category && d.metadata.category !== category) return false;
      if (status && d.status !== status) return false;
      if (tag && !(d.metadata.tags ?? []).some((t: any) => t.label === tag)) return false;
      return true;
    });
  }, [docs, query, category, status, tag]);

  const filtering = !!(query || category || status || tag);

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    const maxOrder = Math.max(0, ...(docs ?? []).map((d) => d.sort_order));
    const { data } = await supabase
      .from("documents")
      .insert({
        workspace_id: workspace.id,
        type: "activity",
        title: newTitle,
        created_by: me.id,
        sort_order: maxOrder + 1,
        metadata: {
          category: newCategory,
          grades: [],
          tags: [],
          checklist: [
            { label: "Draft written", done: false },
            { label: "Reviewed", done: false },
            { label: "Finalized", done: false },
          ],
        },
      })
      .select("id")
      .single();
    setAdding(false);
    setNewTitle("");
    if (data) router.push(`/w/${workspace.id}/activities/${data.id}`);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !docs) return;
    const oldIndex = docs.findIndex((d) => d.id === active.id);
    const newIndex = docs.findIndex((d) => d.id === over.id);
    const next = arrayMove(docs, oldIndex, newIndex);
    setDocs(next);
    await Promise.all(
      next.map((d, i) =>
        d.sort_order !== i + 1
          ? supabase.from("documents").update({ sort_order: i + 1 }).eq("id", d.id)
          : null
      )
    );
  }

  if (docs === null) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Activities</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Ranked like the Common App — but with no 10-slot cap. Drag to set the order.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-paper-sunken p-1" role="tablist" aria-label="View">
            {(["list", "cards"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize",
                  view === v ? "bg-paper-raised shadow-card" : "text-ink-soft"
                )}
              >
                {v === "list" ? "Ranked list" : "Card library"}
              </button>
            ))}
          </div>
          <Button onClick={() => setAdding(true)}>+ Activity</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activities…"
          className="!w-56"
          aria-label="Search activities"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="final">Final</option>
        </Select>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button key={t.label} onClick={() => setTag(tag === t.label ? "" : t.label)}>
                <Chip color={t.color} className={cn(tag === t.label && "ring-1 ring-current")}>
                  {t.label}
                </Chip>
              </button>
            ))}
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <EmptyState
          title="No activities yet"
          hint="Add everything — clubs, jobs, family responsibilities, personal projects. You can rank and trim later."
          action={<Button onClick={() => setAdding(true)}>Add your first activity</Button>}
        />
      ) : view === "list" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtered.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {filtered.map((d, i) => (
                <SortableRow key={d.id} doc={d} rank={docs.indexOf(d) + 1} wsId={workspace.id} dragDisabled={filtering} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link
                href={`/w/${workspace.id}/activities/${d.id}`}
                className="block h-full rounded-card border border-paper-line bg-paper-raised p-4 shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine-50 text-lg" aria-hidden>
                    {iconFor(d.metadata.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="truncate text-xs text-ink-faint">{d.metadata.position || "—"}</p>
                  </div>
                  <StatusPill status={d.status} />
                </div>
                {d.metadata.category && <Chip className="mt-3">{d.metadata.category}</Chip>}
                <p className="mt-2 text-xs text-ink-soft">
                  {d.metadata.hours_per_week ?? "?"} hrs/wk · {d.metadata.weeks_per_year ?? "?"} wks/yr
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(d.metadata.tags ?? []).map((t: any) => (
                    <Chip key={t.label} color={t.color}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
                <ChecklistBar checklist={d.metadata.checklist ?? []} />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New activity">
        <form onSubmit={addActivity} className="space-y-4">
          <div>
            <Label>Activity name</Label>
            <Input autoFocus required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Varsity Soccer" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Create activity
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function ChecklistBar({ checklist }: { checklist: { label: string; done: boolean }[] }) {
  if (!checklist.length) return null;
  const done = checklist.filter((c) => c.done).length;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-ink-faint">
        <span>Progress</span>
        <span>
          {done}/{checklist.length}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
        <div
          className="h-full rounded-full bg-pine-500 transition-[width]"
          style={{ width: `${(done / checklist.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SortableRow({
  doc,
  rank,
  wsId,
  dragDisabled,
}: {
  doc: Doc;
  rank: number;
  wsId: string;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: doc.id,
    disabled: dragDisabled,
  });
  const checklist = doc.metadata.checklist ?? [];
  const done = checklist.filter((c: any) => c.done).length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-card border border-paper-line bg-paper-raised px-3 py-2.5 shadow-card",
        isDragging && "z-10 shadow-lift"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${doc.title}`}
        className={cn(
          "cursor-grab touch-none rounded p-1 text-ink-faint hover:bg-paper-sunken active:cursor-grabbing",
          dragDisabled && "cursor-not-allowed opacity-30"
        )}
        title={dragDisabled ? "Clear filters to reorder" : "Drag to reorder"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
          <circle cx="4" cy="3" r="1.2" /><circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
        </svg>
      </button>
      <span className="w-6 text-center font-display text-sm font-semibold text-ink-faint">{rank}</span>
      <span aria-hidden>{iconFor(doc.metadata.category)}</span>
      <Link href={`/w/${wsId}/activities/${doc.id}`} className="min-w-0 flex-1 hover:text-pine-700">
        <p className="truncate text-sm font-semibold">{doc.title}</p>
        <p className="truncate text-xs text-ink-faint">
          {[doc.metadata.position, doc.metadata.organization].filter(Boolean).join(" · ") || "Add details"}
        </p>
      </Link>
      <div className="hidden flex-wrap gap-1 sm:flex">
        {(doc.metadata.tags ?? []).slice(0, 3).map((t: any) => (
          <Chip key={t.label} color={t.color}>
            {t.label}
          </Chip>
        ))}
      </div>
      <span className="hidden text-xs tabular-nums text-ink-faint md:inline">
        {doc.metadata.hours_per_week ?? "?"}h/wk
      </span>
      {checklist.length > 0 && (
        <span className="hidden text-[11px] text-ink-faint sm:inline" title="Checklist progress">
          {done}/{checklist.length}
        </span>
      )}
      <StatusPill status={doc.status} />
    </li>
  );
}
