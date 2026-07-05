"use client";

import { createClient } from "@/lib/supabase/client";
import type { DocVersion } from "@/lib/types";
import { cn, diffWords, formatDate, tiptapText } from "@/lib/utils";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Avatar, Button, EmptyState, Modal } from "../ui";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const CARD_TINTS = ["#D6E8E2", "#FBEFD3", "#E8E3F0", "#F7E3E1", "#DDE8F0", "#E6EDDA"];

export function VersionLibrary({
  versions,
  onRestore,
  onDelete,
}: {
  versions: DocVersion[];
  onRestore: (v: DocVersion) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
}) {
  const { memberById } = useWorkspace();
  const [viewing, setViewing] = useState<DocVersion | null>(null);
  const [compare, setCompare] = useState<DocVersion[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<DocVersion | null>(null);

  function toggleCompare(v: DocVersion) {
    setCompare((prev) => {
      if (prev.some((p) => p.id === v.id)) return prev.filter((p) => p.id !== v.id);
      return [...prev.slice(-1), v];
    });
  }

  if (!versions.length) {
    return (
      <EmptyState
        title="The library is empty"
        hint="Save a version to start building the draft library. Every saved version lives here forever."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-faint">
          {versions.length} version{versions.length === 1 ? "" : "s"} · select two to compare
        </p>
        {compare.length === 2 && (
          <Button size="sm" onClick={() => setCompareOpen(true)}>
            Compare selected
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {versions.map((v, i) => {
          const author = v.author ?? memberById(v.author_id);
          const selected = compare.some((c) => c.id === v.id);
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
              className={cn(
                "group overflow-hidden rounded-card border bg-paper-raised shadow-card transition-shadow hover:shadow-lift",
                selected ? "border-pine-500 ring-1 ring-pine-500" : "border-paper-line"
              )}
            >
              <button
                className="block w-full text-left"
                onClick={() => setViewing(v)}
                aria-label={`View version ${v.version_label ?? formatDate(v.created_at)}`}
              >
                <div
                  className="flex h-24 items-end p-3"
                  style={
                    v.cover_image_url
                      ? {
                          backgroundImage: `url(${v.cover_image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { backgroundColor: CARD_TINTS[i % CARD_TINTS.length] }
                  }
                >
                  {!v.cover_image_url && (
                    <p className="font-display text-xs italic leading-snug text-ink-soft line-clamp-3">
                      {tiptapText(v.content).slice(0, 120) || "(empty)"}
                    </p>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">
                    {v.version_label || `Version · ${formatDate(v.created_at)}`}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                    <Avatar profile={author} size={16} />
                    <span className="truncate">{author?.display_name}</span>
                    <span>·</span>
                    <span className="tabular-nums">{v.word_count}w</span>
                    <span>·</span>
                    <span>{formatDate(v.created_at)}</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1 border-t border-paper-line px-2 py-1.5 text-[11px]">
                <button
                  className={cn(
                    "rounded px-1.5 py-0.5 hover:bg-paper-sunken",
                    selected ? "font-semibold text-pine-600" : "text-ink-faint"
                  )}
                  onClick={() => toggleCompare(v)}
                >
                  {selected ? "✓ Comparing" : "Compare"}
                </button>
                <button
                  className="rounded px-1.5 py-0.5 text-ink-faint hover:bg-paper-sunken"
                  onClick={() => setConfirmRestore(v)}
                >
                  Restore
                </button>
                <button
                  className="ml-auto rounded px-1.5 py-0.5 text-ink-faint hover:bg-clay-100 hover:text-clay-600"
                  onClick={() => onDelete(v.id)}
                  title="Move to trash (restorable from Settings)"
                >
                  Trash
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Read a single version */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.version_label || "Version"} wide>
        {viewing && (
          <div>
            <p className="mb-4 text-xs text-ink-faint">
              {viewing.word_count} words · saved {formatDate(viewing.created_at)} by{" "}
              {(viewing.author ?? memberById(viewing.author_id))?.display_name}
            </p>
            <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-paper p-4 text-[15px] leading-7">
              {tiptapText(viewing.content) || "(empty)"}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmRestore(viewing);
                  setViewing(null);
                }}
              >
                Restore this version
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore confirmation */}
      <Modal open={!!confirmRestore} onClose={() => setConfirmRestore(null)} title="Restore version?">
        <p className="text-sm text-ink-soft">
          The current working draft will be auto-saved as its own version first — nothing is lost.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRestore(null)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (confirmRestore) await onRestore(confirmRestore);
              setConfirmRestore(null);
            }}
          >
            Restore
          </Button>
        </div>
      </Modal>

      {/* Side-by-side diff */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare versions" wide>
        {compare.length === 2 && <VersionDiff a={compare[0]} b={compare[1]} />}
      </Modal>
    </div>
  );
}

function VersionDiff({ a, b }: { a: DocVersion; b: DocVersion }) {
  // older on the left
  const [older, newer] = a.created_at < b.created_at ? [a, b] : [b, a];
  const parts = useMemo(
    () => diffWords(tiptapText(older.content), tiptapText(newer.content)),
    [older, newer]
  );
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-4 text-xs text-ink-faint">
        <p>
          <strong className="text-ink">{older.version_label || "Older"}</strong> ·{" "}
          {formatDate(older.created_at)} · {older.word_count}w
        </p>
        <p>
          <strong className="text-ink">{newer.version_label || "Newer"}</strong> ·{" "}
          {formatDate(newer.created_at)} · {newer.word_count}w
        </p>
      </div>
      <div className="grid max-h-[55vh] grid-cols-2 gap-4 overflow-y-auto">
        <div className="whitespace-pre-wrap rounded-lg bg-paper p-4 text-sm leading-7">
          {parts
            .filter((p) => p.kind !== "added")
            .map((p, i) => (
              <span key={i} className={p.kind === "removed" ? "bg-clay-100 text-clay-600 line-through" : ""}>
                {p.text}
              </span>
            ))}
        </div>
        <div className="whitespace-pre-wrap rounded-lg bg-paper p-4 text-sm leading-7">
          {parts
            .filter((p) => p.kind !== "removed")
            .map((p, i) => (
              <span key={i} className={p.kind === "added" ? "bg-pine-100 text-pine-700" : ""}>
                {p.text}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Cover image uploader used by the save-version modal */
export function useCoverUpload() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace } = useWorkspace();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    const path = `${workspace.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    setUploading(false);
    if (error) return null;
    return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
  }
  return { upload, uploading };
}
