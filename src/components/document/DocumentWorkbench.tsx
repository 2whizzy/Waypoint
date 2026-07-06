"use client";

import { createClient } from "@/lib/supabase/client";
import type { Comment, DocStatus } from "@/lib/types";
import { cn, tiptapText } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar, Button, Input, Label, Modal, Select, Spinner } from "../ui";
import { parseMentions } from "../workspace/mentions";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { CommentsPanel } from "./CommentsPanel";
import { RichEditor, type RichEditorHandle, type SelectionInfo } from "./RichEditor";
import { useDocument } from "./useDocument";
import { useCoverUpload, VersionLibrary } from "./VersionLibrary";

type Tab = "comments" | "library";

export function DocumentWorkbench({
  documentId,
  wordLimit,
  charLimit,
  placeholder,
  headerExtra,
  aboveEditor,
}: {
  documentId: string;
  wordLimit?: number;
  charLimit?: number;
  placeholder?: string;
  headerExtra?: ReactNode;
  aboveEditor?: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { me, members, presence } = useWorkspace();
  const pathname = usePathname();
  const {
    doc,
    versions,
    comments,
    saving,
    remoteContent,
    saveContent,
    updateDoc,
    saveVersion,
    restoreVersion,
    softDeleteVersion,
    reload,
  } = useDocument(documentId);

  const editorRef = useRef<RichEditorHandle>(null);
  const [tab, setTab] = useState<Tab>("comments");
  const [pendingSelection, setPendingSelection] = useState<SelectionInfo | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const { upload, uploading } = useCoverUpload();
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedVersionNote, setSavedVersionNote] = useState(false);

  const viewers = presence.filter((p) => p.user_id !== me.id && p.path === pathname);

  if (!doc) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  async function addComment(
    content: string,
    anchor: SelectionInfo | null,
    parentId: string | null,
    suggestion?: string
  ) {
    setActionError(null);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        document_id: documentId,
        author_id: me.id,
        content,
        anchor: anchor ? { from: anchor.from, to: anchor.to, quote: anchor.quote } : null,
        parent_id: parentId,
        mentions: parseMentions(content, members),
        suggestion: suggestion || null,
        suggestion_status: suggestion ? "pending" : null,
      })
      .select()
      .single();
    if (error) {
      setActionError(`Couldn't add the comment: ${error.message}`);
      throw error;
    }
    // Tie the comment to the exact text range with a persistent mark
    if (data && anchor && editorRef.current?.editor) {
      const editor = editorRef.current.editor;
      editor
        .chain()
        .setTextSelection({ from: anchor.from, to: anchor.to })
        .setCommentMark(data.id)
        .run();
      saveContent(editor.getJSON());
    }
    reload();
  }

  /** Locate the live range of a comment's mark in the editor. */
  function findCommentRange(commentId: string): { from: number; to: number } | null {
    const editor = editorRef.current?.editor;
    if (!editor) return null;
    let from = -1;
    let to = -1;
    editor.state.doc.descendants((node, pos) => {
      for (const mark of node.marks) {
        if (mark.type.name === "commentMark" && mark.attrs.commentId === commentId) {
          if (from === -1) from = pos;
          to = pos + node.nodeSize;
        }
      }
    });
    return from === -1 ? null : { from, to };
  }

  /** Fallback: find the quoted text anywhere in the draft. */
  function findQuoteRange(quote: string): { from: number; to: number } | null {
    const editor = editorRef.current?.editor;
    if (!editor || !quote) return null;
    let found: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const idx = node.text.indexOf(quote);
      if (idx >= 0) found = { from: pos + idx, to: pos + idx + quote.length };
    });
    return found;
  }

  async function acceptSuggestion(comment: Comment) {
    setActionError(null);
    const editor = editorRef.current?.editor;
    if (!editor || !comment.suggestion) return;
    const range =
      findCommentRange(comment.id) ??
      (comment.anchor?.quote ? findQuoteRange(comment.anchor.quote) : null);
    if (!range) {
      setActionError(
        "Couldn't find the original text in the draft (it may have been edited since). Apply the change by hand, then dismiss the suggestion."
      );
      return;
    }
    editor.chain().focus().setTextSelection(range).insertContent(comment.suggestion).run();
    editor.commands.unsetCommentMark(comment.id);
    saveContent(editor.getJSON());
    const { error } = await supabase
      .from("comments")
      .update({ suggestion_status: "accepted", resolved: true })
      .eq("id", comment.id);
    if (error) setActionError(`Applied in the draft, but couldn't update the comment: ${error.message}`);
    reload();
  }

  async function rejectSuggestion(comment: Comment) {
    setActionError(null);
    const { error } = await supabase
      .from("comments")
      .update({ suggestion_status: "rejected", resolved: true })
      .eq("id", comment.id);
    if (error) {
      setActionError(`Couldn't dismiss the suggestion: ${error.message}`);
      return;
    }
    if (editorRef.current?.editor) {
      editorRef.current.editor.commands.unsetCommentMark(comment.id);
      saveContent(editorRef.current.editor.getJSON());
    }
    reload();
  }

  async function resolveComment(comment: Comment) {
    await supabase.from("comments").update({ resolved: !comment.resolved }).eq("id", comment.id);
    if (!comment.resolved && editorRef.current?.editor) {
      editorRef.current.editor.commands.unsetCommentMark(comment.id);
      saveContent(editorRef.current.editor.getJSON());
    }
    reload();
  }

  function focusComment(id: string) {
    setActiveCommentId(id);
    setTab("comments");
    // scroll the mark into view
    const el = document.querySelector(`[data-comment-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  async function doSaveVersion(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    let coverUrl: string | undefined;
    if (coverFile) coverUrl = (await upload(coverFile)) ?? undefined;
    const editor = editorRef.current?.editor;
    const result = await saveVersion({
      label: label || undefined,
      coverUrl,
      authorId: me.id,
      content: editor ? editor.getJSON() : doc?.current_content,
    });
    if (result?.error) {
      setActionError(`Couldn't save the version: ${result.error.message}`);
      return;
    }
    setLabel("");
    setCoverFile(null);
    setSaveOpen(false);
    setTab("library");
    setSavedVersionNote(true);
    setTimeout(() => setSavedVersionNote(false), 2500);
  }

  function exportText() {
    const text = tiptapText(editorRef.current?.editor?.getJSON() ?? doc?.current_content);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc?.title ?? "document"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const openCount = comments.filter((c) => !c.resolved && !c.parent_id).length;

  return (
    <div>
      {/* Header */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-ink-faint"
          value={titleDraft ?? doc.title}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            if (titleDraft !== null && titleDraft.trim() && titleDraft !== doc.title) {
              updateDoc({ title: titleDraft.trim() });
            }
            setTitleDraft(null);
          }}
          aria-label="Document title"
        />
        <div className="flex items-center gap-2">
          {viewers.length > 0 && (
            <div className="flex items-center gap-1" title={viewers.map((v) => v.display_name).join(", ") + " viewing now"}>
              {viewers.map((v) => (
                <span
                  key={v.user_id}
                  className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: v.color }}
                >
                  {v.display_name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <span className={cn("text-xs transition-opacity", saving ? "text-marigold-600" : "text-ink-faint")}>
            {saving ? "Saving…" : "Saved"}
          </span>
          <Select
            value={doc.status}
            onChange={(e) => updateDoc({ status: e.target.value as DocStatus })}
            className="!w-auto"
            aria-label="Document status"
          >
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="final">Final</option>
          </Select>
          <Button variant="secondary" size="sm" onClick={exportText}>
            Export .txt
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            PDF
          </Button>
          <Button size="sm" onClick={() => setSaveOpen(true)}>
            Save version
          </Button>
        </div>
      </div>

      {headerExtra}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Editor column */}
        <div className="min-w-0">
          {aboveEditor}
          <RichEditor
            ref={editorRef}
            content={doc.current_content}
            remoteContent={remoteContent}
            onChange={(json) => saveContent(json)}
            placeholder={placeholder}
            wordLimit={wordLimit}
            charLimit={charLimit}
            onSelectComment={(sel) => {
              setPendingSelection(sel);
              setTab("comments");
            }}
            onClickCommentMark={focusComment}
          />
        </div>

        {/* Side panel */}
        <aside className="no-print min-w-0">
          <div className="sticky top-16">
            <div className="mb-4 flex rounded-lg bg-paper-sunken p-1" role="tablist">
              {(
                [
                  ["comments", `Comments${openCount ? ` (${openCount})` : ""}`],
                  ["library", `Library (${versions.length})`],
                ] as [Tab, string][]
              ).map(([key, text]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    tab === key ? "bg-paper-raised text-ink shadow-card" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
            {actionError && (
              <div className="mb-3 rounded-lg border border-clay-400/60 bg-clay-600/10 px-3 py-2 text-xs text-clay-600">
                {actionError}
                <button className="ml-2 font-semibold underline" onClick={() => setActionError(null)}>
                  dismiss
                </button>
              </div>
            )}
            {savedVersionNote && (
              <div className="mb-3 rounded-lg border border-pine-300 bg-pine-50 px-3 py-2 text-xs font-medium text-pine-700">
                ✓ Version saved to the library
              </div>
            )}
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {tab === "comments" && (
                <CommentsPanel
                  comments={comments}
                  pendingSelection={pendingSelection}
                  onCancelSelection={() => setPendingSelection(null)}
                  onAdd={addComment}
                  onResolve={resolveComment}
                  onAcceptSuggestion={acceptSuggestion}
                  onRejectSuggestion={rejectSuggestion}
                  activeCommentId={activeCommentId}
                  onFocusComment={focusComment}
                />
              )}
              {tab === "library" && (
                <VersionLibrary
                  versions={versions}
                  onRestore={(v) => restoreVersion(v, me.id)}
                  onDelete={softDeleteVersion}
                />
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Save version modal */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save a version">
        <form onSubmit={doSaveVersion} className="space-y-4">
          <div>
            <Label>Version title</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Draft 2 — tighter opening"
            />
          </div>
          <div>
            <Label>Cover image (optional)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-pine-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-pine-700"
            />
          </div>
          <p className="text-xs text-ink-faint">
            This snapshots the current draft into the library. You keep editing the working copy —
            saved versions are never overwritten.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Save to library"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
