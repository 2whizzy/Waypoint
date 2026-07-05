"use client";

import { createClient } from "@/lib/supabase/client";
import type { Resource } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Button, Input, Select, Textarea } from "../ui";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function ResourcesPanel({
  resources,
  documentId,
  onChanged,
}: {
  resources: Resource[];
  documentId: string | null; // null = workspace-level
  onChanged?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me, memberById } = useWorkspace();
  const [type, setType] = useState<"link" | "note" | "file">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let file_path: string | null = null;
    if (type === "file" && file) {
      const path = `${workspace.id}/${documentId ?? "workspace"}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("files").upload(path, file);
      if (!error) file_path = path;
    }
    await supabase.from("resources").insert({
      workspace_id: workspace.id,
      document_id: documentId,
      type,
      title: title || (type === "file" ? file?.name ?? "File" : url || "Note"),
      content: type === "note" ? note : null,
      url: type === "link" ? url : null,
      file_path,
      added_by: me.id,
    });
    setTitle("");
    setUrl("");
    setNote("");
    setFile(null);
    setAdding(false);
    setBusy(false);
    onChanged?.();
  }

  async function openFile(r: Resource) {
    if (!r.file_path) return;
    const { data } = await supabase.storage.from("files").createSignedUrl(r.file_path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(r: Resource) {
    await supabase.from("resources").delete().eq("id", r.id);
    onChanged?.();
  }

  return (
    <div className="space-y-3">
      {!adding ? (
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          + Add resource
        </Button>
      ) : (
        <form onSubmit={add} className="space-y-2.5 rounded-lg border border-paper-line bg-paper-raised p-3">
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="link">Link</option>
            <option value="note">Note</option>
            <option value="file">File</option>
          </Select>
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          {type === "link" && (
            <Input type="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
          {type === "note" && (
            <Textarea required rows={3} placeholder="Write a note…" value={note} onChange={(e) => setNote(e.target.value)} />
          )}
          {type === "file" && (
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-pine-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-pine-700"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      {resources.length === 0 && !adding && (
        <p className="py-4 text-center text-sm text-ink-faint">
          Attach links, notes, or files that support this draft.
        </p>
      )}

      {resources.map((r) => (
        <div key={r.id} className="group flex items-start gap-2.5 rounded-lg border border-paper-line bg-paper-raised p-3">
          <span aria-hidden className="mt-0.5">
            {r.type === "link" ? "🔗" : r.type === "note" ? "📝" : "📎"}
          </span>
          <div className="min-w-0 flex-1">
            {r.type === "link" && r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-pine-600 hover:underline">
                {r.title || r.url}
              </a>
            ) : r.type === "file" ? (
              <button onClick={() => openFile(r)} className="block truncate text-sm font-medium text-pine-600 hover:underline">
                {r.title}
              </button>
            ) : (
              <p className="text-sm font-medium">{r.title}</p>
            )}
            {r.content && <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{r.content}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">
              {memberById(r.added_by)?.display_name} · {formatRelative(r.created_at)}
            </p>
          </div>
          <button
            onClick={() => remove(r)}
            className="text-[11px] text-ink-faint opacity-0 transition-opacity hover:text-clay-600 group-hover:opacity-100"
            aria-label="Delete resource"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
