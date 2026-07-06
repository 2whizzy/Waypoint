"use client";

import type { Comment } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { useState } from "react";
import { Avatar, Button, Textarea } from "../ui";
import { splitMentionSegments } from "../workspace/mentions";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import type { SelectionInfo } from "./RichEditor";

export function CommentsPanel({
  comments,
  pendingSelection,
  onCancelSelection,
  onAdd,
  onResolve,
  onAcceptSuggestion,
  onRejectSuggestion,
  activeCommentId,
  onFocusComment,
}: {
  comments: Comment[];
  pendingSelection: SelectionInfo | null;
  onCancelSelection: () => void;
  onAdd: (
    content: string,
    anchor: SelectionInfo | null,
    parentId: string | null,
    suggestion?: string
  ) => Promise<void>;
  onResolve: (comment: Comment) => Promise<void>;
  onAcceptSuggestion: (comment: Comment) => Promise<void>;
  onRejectSuggestion: (comment: Comment) => Promise<void>;
  activeCommentId: string | null;
  onFocusComment: (id: string) => void;
}) {
  const { memberById } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionDraft, setSuggestionDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const topLevel = comments.filter((c) => !c.parent_id && (showResolved || !c.resolved));
  const repliesFor = (id: string) => comments.filter((c) => c.parent_id === id);

  function resetComposer() {
    setDraft("");
    setSuggesting(false);
    setSuggestionDraft("");
    onCancelSelection();
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const suggestion = suggesting ? suggestionDraft.trim() : "";
    if (!draft.trim() && !suggestion) return;
    try {
      await onAdd(draft.trim(), pendingSelection, null, suggestion || undefined);
    } catch {
      return; // error is surfaced by the workbench banner; keep the draft
    }
    resetComposer();
  }

  function startSuggesting() {
    setSuggesting(true);
    if (!suggestionDraft) setSuggestionDraft(pendingSelection?.quote ?? "");
  }

  return (
    <div className="space-y-4">
      {/* Composer for a text selection: comment and/or suggestion */}
      {pendingSelection && (
        <div className="rounded-lg border border-marigold-300 bg-marigold-100/50 p-3">
          <p className="mb-2 border-l-2 border-marigold-400 pl-2 text-xs italic text-ink-soft line-clamp-2">
            “{pendingSelection.quote}”
          </p>
          <form onSubmit={submitNew} className="space-y-2">
            <Textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                suggesting
                  ? "Why this change? (optional note — @Name to mention)"
                  : "Comment on this selection… (@Name to mention)"
              }
            />
            {suggesting ? (
              <div className="rounded-md border border-pine-300 bg-pine-50 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-pine-700">
                  Suggested replacement
                </p>
                <Textarea
                  rows={2}
                  value={suggestionDraft}
                  onChange={(e) => setSuggestionDraft(e.target.value)}
                  placeholder="Rewrite the selected text the way you think it should read…"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={startSuggesting}
                className="text-xs font-medium text-pine-600 hover:underline"
              >
                ✎ Suggest a change to this text
              </button>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={resetComposer}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                {suggesting ? "Send suggestion" : "Comment"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {!pendingSelection && (
        <form onSubmit={submitNew}>
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="General comment… (select text in the editor to comment or suggest inline)"
          />
          {draft.trim() && (
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm">
                Comment
              </Button>
            </div>
          )}
        </form>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {topLevel.length} {showResolved ? "comments" : "open"}
        </p>
        <button
          className="text-xs text-pine-600 hover:underline"
          onClick={() => setShowResolved((v) => !v)}
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>
      </div>

      {topLevel.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">
          No comments yet. Select any text in the draft to comment on it or suggest a rewrite.
        </p>
      )}

      {topLevel.map((c) => {
        const author = c.author ?? memberById(c.author_id);
        const isSuggestion = !!c.suggestion;
        return (
          <div
            key={c.id}
            id={`comment-${c.id}`}
            style={{ borderLeftColor: author?.color ?? undefined }}
            className={cn(
              "rounded-lg border border-l-4 p-3 transition-colors",
              activeCommentId === c.id
                ? "border-marigold-400 bg-marigold-100/40"
                : "border-paper-line bg-paper-raised",
              c.resolved && "opacity-70"
            )}
          >
            <div className="flex items-center gap-2">
              <Avatar profile={author} size={22} />
              <span className="text-xs font-semibold">{author?.display_name}</span>
              {isSuggestion && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    c.suggestion_status === "accepted" && "bg-pine-100 text-pine-700",
                    c.suggestion_status === "rejected" && "bg-paper-sunken text-ink-faint",
                    c.suggestion_status === "pending" && "bg-marigold-100 text-marigold-600"
                  )}
                >
                  {c.suggestion_status === "accepted"
                    ? "✓ applied"
                    : c.suggestion_status === "rejected"
                      ? "dismissed"
                      : "suggestion"}
                </span>
              )}
              <span className="text-[11px] text-ink-faint">{formatRelative(c.created_at)}</span>
              {!isSuggestion && (
                <button
                  className="ml-auto text-[11px] font-medium text-pine-600 hover:underline"
                  onClick={() => onResolve(c)}
                >
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
              )}
            </div>

            {c.anchor?.quote && !isSuggestion && (
              <button
                className="mt-2 block w-full border-l-2 border-marigold-400 pl-2 text-left text-xs italic text-ink-soft line-clamp-2 hover:text-ink"
                onClick={() => onFocusComment(c.id)}
                title="Jump to text"
              >
                “{c.anchor.quote}”
              </button>
            )}

            {isSuggestion && (
              <button
                className="mt-2 block w-full rounded-md border border-paper-line bg-paper p-2 text-left text-xs"
                onClick={() => onFocusComment(c.id)}
                title="Jump to text"
              >
                <span className="block text-clay-600 line-through decoration-clay-600/60">
                  {c.anchor?.quote}
                </span>
                <span className="mt-1 block font-medium text-pine-700">{c.suggestion}</span>
              </button>
            )}

            {c.content && (
              <p className="mt-1.5 text-sm">
                {splitMentionSegments(c.content).map((seg, i) =>
                  seg.mention ? (
                    <strong key={i} className="text-pine-600">
                      {seg.text}
                    </strong>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  )
                )}
              </p>
            )}

            {isSuggestion && c.suggestion_status === "pending" && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onAcceptSuggestion(c)}>
                  ✓ Accept &amp; apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRejectSuggestion(c)}>
                  Dismiss
                </Button>
              </div>
            )}

            {repliesFor(c.id).map((r) => {
              const rAuthor = r.author ?? memberById(r.author_id);
              return (
                <div key={r.id} className="ml-4 mt-2 border-l border-paper-line pl-3">
                  <div className="flex items-center gap-2">
                    <Avatar profile={rAuthor} size={18} />
                    <span className="text-xs font-semibold">{rAuthor?.display_name}</span>
                    <span className="text-[11px] text-ink-faint">{formatRelative(r.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm">{r.content}</p>
                </div>
              );
            })}

            {replyTo === c.id ? (
              <form
                className="mt-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!replyDraft.trim()) return;
                  try {
                    await onAdd(replyDraft.trim(), null, c.id);
                  } catch {
                    return;
                  }
                  setReplyDraft("");
                  setReplyTo(null);
                }}
              >
                <Textarea
                  autoFocus
                  rows={2}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Reply…"
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Reply
                  </Button>
                </div>
              </form>
            ) : (
              !c.resolved && (
                <button
                  className="mt-2 text-[11px] text-ink-faint hover:text-pine-600"
                  onClick={() => setReplyTo(c.id)}
                >
                  Reply
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
