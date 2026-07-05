"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Chip, Input, Label, LimitMeter, Select, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_CATEGORIES, GRADE_LEVELS, TAG_COLORS, type ActivityMeta, type Doc } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ActivityDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { workspace } = useWorkspace();
  const [meta, setMeta] = useState<ActivityMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const [newCheck, setNewCheck] = useState("");

  useEffect(() => {
    supabase
      .from("documents")
      .select("metadata")
      .eq("id", docId)
      .single()
      .then(({ data }) => {
        setMeta((data?.metadata as ActivityMeta) ?? {});
        setLoaded(true);
      });
  }, [supabase, docId]);

  function patch(p: Partial<ActivityMeta>) {
    setMeta((prev) => {
      const next = { ...(prev ?? {}), ...p };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        supabase.from("documents").update({ metadata: next }).eq("id", docId).then();
      }, 700);
      return next;
    });
  }

  if (!loaded || !meta) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const form = (
    <details open className="no-print mb-6 rounded-card border border-paper-line bg-paper-raised shadow-card">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-ink-soft">
        Common App fields
      </summary>
      <div className="grid gap-4 border-t border-paper-line p-5 sm:grid-cols-2">
        <div>
          <Label>Category</Label>
          <Select value={meta.category ?? ""} onChange={(e) => patch({ category: e.target.value })}>
            <option value="" disabled>
              Choose…
            </option>
            {ACTIVITY_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Organization name</Label>
          <Input
            value={meta.organization ?? ""}
            onChange={(e) => patch({ organization: e.target.value })}
            placeholder="e.g. Lincoln High School"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="!mb-0">Position / leadership description</Label>
            <LimitMeter count={(meta.position ?? "").length} limit={50} unit="chars" />
          </div>
          <Input
            value={meta.position ?? ""}
            onChange={(e) => patch({ position: e.target.value })}
            placeholder="e.g. Team Captain (Grade 12); Varsity since Grade 10"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="!mb-0">Final description (what goes in the Common App)</Label>
            <LimitMeter count={(meta.description ?? "").length} limit={150} unit="chars" />
          </div>
          <textarea
            className="w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm focus:border-pine-400"
            rows={3}
            value={meta.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Led 20-player squad; organized preseason training; state semifinals 2025…"
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            150 characters is the Common App reference limit — flagged, never truncated. Use the
            expanded draft below to work out what earns a spot here.
          </p>
        </div>
        <div>
          <Label>Participation grade levels</Label>
          <div className="flex gap-1.5">
            {GRADE_LEVELS.map((g) => {
              const active = (meta.grades ?? []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    patch({
                      grades: active
                        ? (meta.grades ?? []).filter((x) => x !== g)
                        : [...(meta.grades ?? []), g],
                    })
                  }
                  className={cn(
                    "h-9 w-10 rounded-lg border text-sm font-medium transition-colors",
                    active
                      ? "border-pine-600 bg-pine-600 text-white"
                      : "border-paper-line bg-paper-raised text-ink-soft hover:border-pine-300"
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Hours / week</Label>
            <Input
              type="number"
              min={0}
              max={168}
              value={meta.hours_per_week ?? ""}
              onChange={(e) => patch({ hours_per_week: e.target.value === "" ? undefined : +e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Label>Weeks / year</Label>
            <Input
              type="number"
              min={0}
              max={52}
              value={meta.weeks_per_year ?? ""}
              onChange={(e) => patch({ weeks_per_year: e.target.value === "" ? undefined : +e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={meta.continue_in_college ?? false}
            onChange={(e) => patch({ continue_in_college: e.target.checked })}
            className="h-4 w-4 accent-pine-600"
          />
          I intend to participate in a similar activity in college
        </label>

        {/* Tags */}
        <div className="sm:col-span-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {(meta.tags ?? []).map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => patch({ tags: (meta.tags ?? []).filter((x) => x.label !== t.label) })}
                title="Remove tag"
              >
                <Chip color={t.color}>{t.label} ✕</Chip>
              </button>
            ))}
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTag.trim()) return;
                patch({ tags: [...(meta.tags ?? []), { label: newTag.trim(), color: newTagColor }] });
                setNewTag("");
              }}
            >
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag…"
                className="!w-28 !py-1 text-xs"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Tag color ${c}`}
                    onClick={() => setNewTagColor(c)}
                    className={cn("h-4 w-4 rounded-full", newTagColor === c && "ring-2 ring-ink ring-offset-1")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button type="submit" className="text-xs font-medium text-pine-600 hover:underline">
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Mini checklist */}
        <div className="sm:col-span-2">
          <Label>Progress checklist</Label>
          <div className="space-y-1.5">
            {(meta.checklist ?? []).map((c, i) => (
              <div key={i} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) => {
                    const next = [...(meta.checklist ?? [])];
                    next[i] = { ...c, done: e.target.checked };
                    patch({ checklist: next });
                  }}
                  className="h-4 w-4 accent-pine-600"
                />
                <span className={cn("text-sm", c.done && "text-ink-faint line-through")}>{c.label}</span>
                <button
                  type="button"
                  className="text-[11px] text-ink-faint opacity-0 hover:text-clay-600 group-hover:opacity-100"
                  onClick={() => patch({ checklist: (meta.checklist ?? []).filter((_, j) => j !== i) })}
                >
                  remove
                </button>
              </div>
            ))}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCheck.trim()) return;
                patch({ checklist: [...(meta.checklist ?? []), { label: newCheck.trim(), done: false }] });
                setNewCheck("");
              }}
            >
              <Input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                placeholder="Add checklist item…"
                className="!w-52 !py-1 text-xs"
              />
              <button type="submit" className="text-xs font-medium text-pine-600 hover:underline">
                Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </details>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/w/${workspace.id}/activities`}
        className="no-print mb-2 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← Activities
      </Link>
      <DocumentWorkbench
        documentId={docId}
        headerExtra={form}
        placeholder="Expanded draft: everything about this activity — stories, numbers, impact. Distill it into the 150-char final description above."
      />
    </div>
  );
}
