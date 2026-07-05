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
  activeCommentId,
  onFocusComment,
}: {
  comments: Comment[];
  pendingSelection: SelectionInfo | null;
  onCancelSelection: () => void;
  onAdd: (content: string, anchor: SelectionInfo | null, parentId: string | null) => Promise<void>;
  onResolve: (comment: Comment) => Promise<void>;
  activeCommentId: string | null;
  onFocusComment: (id: string) => void;
}) {
  const { memberById } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const topLevel = comments.filter((c) => !c.parent_id && (showResolved || !c.resolved));
  const repliesFor = (id: string) => comments.filter((c) => c.parent_id === id);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await onAdd(draft.trim(), pendingSelection, null);
    setDraft("");
    onCancelSelection();
  }

  return (
    <div className="space-y-4">
      {pendingSelection && (
        <div className="rounded-lg border border-marigold-300 bg-marigold-100/50 p-3">
          <p className="mb-2 border-l-2 border-marigold-400 pl-2 text-xs italic text-ink-soft line-clamp-2">
            “{pendingSelection.quote}”
          </p>
          <form onSubmit={submitNew}>
            <Textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Comment on this selection… (@Name to mention)"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancelSelection}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Comment
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
            placeholder="General comment… (select text in the editor to comment inline)"
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
        <p className="py-6 text-center text-sm text-ink-faint">No comments yet.</p>
      )}

      {topLevel.map((c) => {
        const author = c.author ?? memberById(c.author_id);
        return (
          <div
            key={c.id}
            id={`comment-${c.id}`}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              activeCommentId === c.id
                ? "border-marigold-400 bg-marigold-100/40"
                : "border-paper-line bg-paper-raised",
              c.resolved && "opacity-60"
            )}
          >
            <div className="flex items-center gap-2">
              <Avatar profile={author} size={22} />
              <span className="text-xs font-semibold">{author?.display_name}</span>
              <span className="text-[11px] text-ink-faint">{formatRelative(c.created_at)}</span>
              <button
                className="ml-auto text-[11px] font-medium text-pine-600 hover:underline"
                onClick={() => onResolve(c)}
              >
                {c.resolved ? "Reopen" : "Resolve"}
              </button>
            </div>
            {c.anchor?.quote && (
              <button
                className="mt-2 block w-full border-l-2 border-marigold-400 pl-2 text-left text-xs italic text-ink-soft line-clamp-2 hover:text-ink"
                onClick={() => onFocusComment(c.id)}
                title="Jump to text"
              >
                “{c.anchor.quote}”
              </button>
            )}
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
                  await onAdd(replyDraft.trim(), null, c.id);
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
