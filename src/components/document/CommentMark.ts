import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  onClick?: (commentId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setCommentMark: (commentId: string) => ReturnType;
      unsetCommentMark: (commentId: string) => ReturnType;
    };
  }
}

/** Persistent inline mark tying a text range to a comment thread. */
export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "commentMark",
  inclusive: false,
  excludes: "",

  addOptions() {
    return { onClick: undefined };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => ({ "data-comment-id": attrs.commentId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "comment-highlight" }), 0];
  },

  addCommands() {
    return {
      setCommentMark:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetCommentMark:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          const markType = state.schema.marks[this.name];
          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.commentId === commentId) {
                tr.removeMark(pos, pos + node.nodeSize, markType);
              }
            });
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
