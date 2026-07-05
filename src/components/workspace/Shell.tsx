"use client";

import type { Notification } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelative } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "../ui";
import { ChatPanel } from "./ChatPanel";
import { useWorkspace } from "./WorkspaceProvider";

const NAV = [
  { slug: "", label: "Dashboard", icon: "◈" },
  { slug: "essay", label: "Essay", icon: "✎" },
  { slug: "activities", label: "Activities", icon: "▤" },
  { slug: "recommenders", label: "Recommenders", icon: "✉" },
  { slug: "extras", label: "Extras & Context", icon: "＋" },
  { slug: "schools", label: "Schools & Supplementals", icon: "⚑" },
  { slug: "tasks", label: "Tasks", icon: "☑" },
  { slug: "search", label: "Search", icon: "⌕" },
  { slug: "settings", label: "Settings", icon: "⚙" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { workspace, me, presence } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileNav, setMobileNav] = useState(false);

  const base = `/w/${workspace.id}`;
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", me.id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setNotifications(data ?? []));
    const channel = supabase
      .channel(`notif:${workspace.id}:${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        (payload) => {
          const n = payload.new as Notification;
          if (n.workspace_id === workspace.id)
            setNotifications((prev) => [n, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, workspace.id, me.id]);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  }

  const missedBanner = notifications.find((n) => n.kind === "task_missed" && !n.read);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Workspace">
      {NAV.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base;
        const active = item.slug
          ? pathname.startsWith(href)
          : pathname === base;
        const viewers = presence.filter(
          (p) => p.user_id !== me.id && (item.slug ? p.path.startsWith(href) : p.path === base)
        );
        return (
          <Link
            key={item.slug}
            href={href}
            onClick={() => setMobileNav(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-pine-600 font-medium text-white"
                : "text-ink-soft hover:bg-paper-sunken hover:text-ink"
            )}
          >
            <span aria-hidden className="w-4 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {viewers.length > 0 && (
              <span className="flex -space-x-1" title={viewers.map((v) => v.display_name).join(", ") + " here now"}>
                {viewers.slice(0, 3).map((v) => (
                  <span
                    key={v.user_id}
                    className="h-2 w-2 rounded-full ring-1 ring-paper-raised"
                    style={{ backgroundColor: v.color }}
                  />
                ))}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-paper-line bg-paper-raised px-3 py-5 md:flex">
        <Link href="/workspaces" className="mb-1 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-pine-600">
          Waypoint
        </Link>
        <p className="mb-6 truncate px-3 font-display text-lg font-semibold" title={workspace.name}>
          {workspace.name}
        </p>
        {nav}
        <div className="mt-auto space-y-3 px-3">
          <div className="flex items-center gap-1.5" aria-label="Currently online">
            {presence.map((p) => (
              <span key={p.user_id} className="relative" title={`${p.display_name} is online`}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.display_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper-raised bg-pine-400" />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-paper-line pt-3">
            <Avatar profile={me} size={30} />
            <span className="truncate text-sm text-ink-soft">{me.display_name}</span>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-paper-line bg-paper/90 px-4 py-2.5 backdrop-blur">
          <button
            className="rounded-md p-1.5 text-ink-soft hover:bg-paper-sunken md:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setChatOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-paper-sunken"
          >
            💬 Chat
          </button>
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-paper-sunken"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              🔔
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-600 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 z-40 w-80 rounded-card border border-paper-line bg-paper-raised shadow-lift"
                >
                  <div className="flex items-center justify-between border-b border-paper-line px-4 py-2.5">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-pine-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-ink-faint">Nothing yet.</p>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "border-b border-paper-line px-4 py-3 text-sm last:border-0",
                          !n.read && "bg-pine-50"
                        )}
                      >
                        <p>{n.body}</p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">{formatRelative(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {missedBanner && (
          <div className="no-print flex items-center justify-between gap-3 bg-clay-100 px-4 py-2 text-sm text-clay-600">
            <span>⚠ {missedBanner.body}</span>
            <button
              className="text-xs font-semibold underline"
              onClick={async () => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === missedBanner.id ? { ...n, read: true } : n))
                );
                await supabase.from("notifications").update({ read: true }).eq("id", missedBanner.id);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/30 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              className="fixed bottom-0 left-0 top-0 z-50 w-64 border-r border-paper-line bg-paper-raised px-3 py-5 md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
            >
              <p className="mb-6 truncate px-3 font-display text-lg font-semibold">{workspace.name}</p>
              {nav}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
