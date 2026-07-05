"use client";

import { cn, countWords } from "@/lib/utils";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { LimitMeter } from "../ui";
import { CommentMark } from "./CommentMark";

export interface RichEditorHandle {
  editor: Editor | null;
}

export interface SelectionInfo {
  from: number;
  to: number;
  quote: string;
}

export const RichEditor = forwardRef<
  RichEditorHandle,
  {
    content: any;
    onChange: (json: any, text: string) => void;
    remoteContent?: { content: any; ts: number } | null;
    placeholder?: string;
    wordLimit?: number;
    charLimit?: number;
    onSelectComment?: (selection: SelectionInfo) => void;
    onClickCommentMark?: (commentId: string) => void;
    editable?: boolean;
  }
>(function RichEditor(
  {
    content,
    onChange,
    remoteContent,
    placeholder = "Start writing…",
    wordLimit,
    charLimit,
    onSelectComment,
    onClickCommentMark,
    editable = true,
  },
  ref
) {
  const lastRemoteTs = useRef(0);
  const lastTypedAt = useRef(0);

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder }),
      CommentMark,
    ],
    content: content && Object.keys(content).length ? content : undefined,
    onUpdate({ editor }) {
      lastTypedAt.current = Date.now();
      onChange(editor.getJSON(), editor.getText());
    },
    editorProps: {
      attributes: { class: "tiptap", "aria-label": "Document editor" },
      handleClickOn(_view, _pos, node, _nodePos, event) {
        const el = event.target as HTMLElement;
        const id = el.closest?.("[data-comment-id]")?.getAttribute("data-comment-id");
        if (id && onClickCommentMark) {
          onClickCommentMark(id);
          return true;
        }
        return false;
      },
    },
  });

  useImperativeHandle(ref, () => ({ editor }), [editor]);

  // Apply remote edits, but never while the local user is actively typing
  useEffect(() => {
    if (!editor || !remoteContent) return;
    if (remoteContent.ts <= lastRemoteTs.current) return;
    if (Date.now() - lastTypedAt.current < 2000) return;
    lastRemoteTs.current = remoteContent.ts;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(remoteContent.content, { emitUpdate: false });
    try {
      editor.commands.setTextSelection({ from, to });
    } catch {
      /* selection out of range after remote change */
    }
  }, [editor, remoteContent]);

  if (!editor) return <div className="min-h-[50vh]" />;

  const text = editor.getText();
  const words = countWords(text);
  const chars = text.length;

  return (
    <div>
      {editable && (
        <div className="no-print sticky top-12 z-20 mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-paper-line bg-paper-raised/95 px-2 py-1.5 backdrop-blur">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
          >
            <b>B</b>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
          >
            <i>I</i>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="Underline"
          >
            <u>U</u>
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-paper-line" aria-hidden />
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            label="Heading"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            label="Subheading"
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            ••
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-paper-line" aria-hidden />
          <ToolbarButton
            active={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            label="Highlight"
          >
            <span className="rounded-sm bg-marigold-200 px-1">H</span>
          </ToolbarButton>
          {onSelectComment && (
            <ToolbarButton
              onClick={() => {
                const { from, to } = editor.state.selection;
                if (from === to) return;
                const quote = editor.state.doc.textBetween(from, to, " ");
                onSelectComment({ from, to, quote });
              }}
              label="Comment on selection"
            >
              💬+
            </ToolbarButton>
          )}
          <div className="ml-auto flex items-center gap-3 pl-2">
            {wordLimit ? (
              <LimitMeter count={words} limit={wordLimit} unit="words" />
            ) : charLimit ? (
              <LimitMeter count={chars} limit={charLimit} unit="chars" />
            ) : (
              <span className="text-xs tabular-nums text-ink-faint">{words} words</span>
            )}
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
});

function ToolbarButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "min-w-8 rounded-md px-2 py-1 text-sm transition-colors",
        active ? "bg-pine-100 text-pine-700" : "text-ink-soft hover:bg-paper-sunken"
      )}
    >
      {children}
    </button>
  );
}
