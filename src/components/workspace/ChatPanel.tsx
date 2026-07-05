"use client";

import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Input } from "../ui";
import { parseMentions, splitMentionSegments } from "./mentions";
import { useWorkspace } from "./WorkspaceProvider";

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me, members, memberById } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("messages")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel(`chat:${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${workspace.id}` },
        (payload) => setMessages((prev) =>
          prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message]
        )
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, workspace.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const { data } = await supabase
      .from("messages")
      .insert({
        workspace_id: workspace.id,
        sender_id: me.id,
        content,
        mentions: parseMentions(content, members),
      })
      .select()
      .single();
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-paper-line bg-paper-raised shadow-lift"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            aria-label="Workspace chat"
          >
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <h2 className="font-display text-lg font-semibold">Chat</h2>
              <button onClick={onClose} aria-label="Close chat" className="rounded-md p-1 text-ink-faint hover:bg-paper-sunken">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-ink-faint">
                  No messages yet. Use @Name to notify someone.
                </p>
              )}
              {messages.map((msg) => {
                const sender = memberById(msg.sender_id);
                const mine = msg.sender_id === me.id;
                return (
                  <div key={msg.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                    <Avatar profile={sender} size={26} />
                    <div className={cn("max-w-[75%]", mine && "text-right")}>
                      <p className="text-[11px] text-ink-faint">
                        {sender?.display_name ?? "Unknown"} · {formatRelative(msg.created_at)}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 inline-block rounded-xl px-3 py-1.5 text-left text-sm",
                          mine ? "bg-pine-600 text-white" : "bg-paper-sunken text-ink"
                        )}
                      >
                        {splitMentionSegments(msg.content).map((seg, i) =>
                          seg.mention ? (
                            <strong key={i} className={mine ? "text-marigold-200" : "text-pine-600"}>
                              {seg.text}
                            </strong>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="border-t border-paper-line p-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message… (@Name to mention)"
                aria-label="Chat message"
              />
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
