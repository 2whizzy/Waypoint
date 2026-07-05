"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Button, Modal, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc, DocVersion, SupplementalMeta } from "@/lib/types";
import { formatDate, tiptapText, wordCountOf } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SupplementalPage() {
  const { docId } = useParams<{ docId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const [meta, setMeta] = useState<SupplementalMeta | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    supabase
      .from("documents")
      .select("metadata")
      .eq("id", docId)
      .single()
      .then(({ data }) => setMeta((data?.metadata as SupplementalMeta) ?? {}));
  }, [supabase, docId]);

  if (!meta)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  const header = (
    <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-3 rounded-card border border-pine-100 bg-pine-50 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-pine-600">The prompt</p>
        <p className="mt-1 font-medium leading-snug">{meta.question ?? "—"}</p>
        {meta.limit_value && (
          <p className="mt-1 text-xs text-ink-faint">
            Stated limit: {meta.limit_value} {meta.limit_unit ?? "words"} (reference only — never enforced)
          </p>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
        ⇪ Import an existing answer
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={meta.school_id ? `/w/${workspace.id}/schools/${meta.school_id}` : `/w/${workspace.id}/schools`}
        className="no-print mb-2 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← Back to school
      </Link>
      <DocumentWorkbench
        key={editorKey}
        documentId={docId}
        wordLimit={meta.limit_unit !== "chars" ? meta.limit_value : undefined}
        charLimit={meta.limit_unit === "chars" ? meta.limit_value : undefined}
        headerExtra={header}
        placeholder="Draft your answer — or import a similar one you've already written and adapt it."
      />
      <ImportPicker
        open={importOpen}
        onClose={() => setImportOpen(false)}
        targetDocId={docId}
        onImported={() => {
          setImportOpen(false);
          setEditorKey((k) => k + 1); // remount workbench so the imported content loads
        }}
      />
    </div>
  );
}

/**
 * Cross-import: copy any existing answer (current draft or a specific saved
 * version, from any school's supplemental or the main essay) into this
 * question as a new version. The source is never touched.
 */
function ImportPicker({
  open,
  onClose,
  targetDocId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  targetDocId: string;
  onImported: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const [sources, setSources] = useState<(Doc & { school_name?: string })[] | null>(null);
  const [versionsFor, setVersionsFor] = useState<Doc | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: docs }, { data: schools }] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .eq("workspace_id", workspace.id)
          .in("type", ["supplemental", "essay", "extra"])
          .is("deleted_at", null)
          .neq("id", targetDocId)
          .order("updated_at", { ascending: false }),
        supabase.from("workspace_schools").select("id, school:schools(name)").eq("workspace_id", workspace.id),
      ]);
      const schoolName = (id?: string) =>
        (schools as any[])?.find((s) => s.id === id)?.school?.name;
      setSources(
        (docs ?? []).map((d: Doc) => ({ ...d, school_name: schoolName(d.metadata.school_id) }))
      );
    })();
  }, [open, supabase, workspace.id, targetDocId]);

  async function pickVersions(doc: Doc) {
    setVersionsFor(doc);
    const { data } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", doc.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setVersions(data ?? []);
  }

  async function doImport(content: any, sourceLabel: string) {
    setBusy(true);
    const { data: target } = await supabase
      .from("documents")
      .select("current_content")
      .eq("id", targetDocId)
      .single();
    // keep whatever was here as its own version first
    if (target?.current_content && wordCountOf(target.current_content) > 0) {
      await supabase.from("document_versions").insert({
        document_id: targetDocId,
        content: target.current_content,
        author_id: me.id,
        version_label: "Auto-saved before import",
        word_count: wordCountOf(target.current_content),
      });
    }
    await supabase.from("documents").update({ current_content: content }).eq("id", targetDocId);
    await supabase.from("document_versions").insert({
      document_id: targetDocId,
      content,
      author_id: me.id,
      version_label: `Imported from ${sourceLabel}`,
      word_count: wordCountOf(content),
    });
    setBusy(false);
    setVersionsFor(null);
    onImported();
  }

  return (
    <Modal open={open} onClose={onClose} title={versionsFor ? `Versions of “${versionsFor.title}”` : "Import an answer"} wide>
      {busy ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : versionsFor ? (
        <div className="space-y-2">
          <button className="text-xs text-pine-600 hover:underline" onClick={() => setVersionsFor(null)}>
            ← All answers
          </button>
          <button
            onClick={() => doImport(versionsFor.current_content, `${versionsFor.title} (current draft)`)}
            className="block w-full rounded-lg border border-paper-line p-3 text-left hover:border-pine-300"
          >
            <p className="text-sm font-semibold">Current working draft</p>
            <p className="mt-1 text-xs text-ink-soft line-clamp-2">
              {tiptapText(versionsFor.current_content).slice(0, 160) || "(empty)"}
            </p>
          </button>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => doImport(v.content, `${versionsFor.title} — ${v.version_label ?? formatDate(v.created_at)}`)}
              className="block w-full rounded-lg border border-paper-line p-3 text-left hover:border-pine-300"
            >
              <p className="text-sm font-semibold">
                {v.version_label || `Version · ${formatDate(v.created_at)}`}{" "}
                <span className="font-normal text-ink-faint">· {v.word_count}w</span>
              </p>
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">{tiptapText(v.content).slice(0, 160)}</p>
            </button>
          ))}
        </div>
      ) : sources === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : sources.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Nothing to import yet — write your first answer anywhere and it&apos;ll show up here.</p>
      ) : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          <p className="mb-3 text-xs text-ink-faint">
            The import lands as a clearly-marked new version here — the original stays untouched.
            Pick an answer to use its current draft, or browse its saved versions.
          </p>
          {sources.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-paper-line p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {d.metadata.question || d.title}
                </p>
                <p className="text-[11px] text-ink-faint">
                  {d.type === "essay" ? "Personal essay" : d.type === "extra" ? "Extras & Context" : d.school_name ?? "Supplemental"}
                  {" · "}
                  {wordCountOf(d.current_content)}w drafted
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => pickVersions(d)}>
                Versions…
              </Button>
              <Button size="sm" onClick={() => doImport(d.current_content, `${d.title} (current draft)`)}>
                Import draft
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
