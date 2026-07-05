"use client";

import { Avatar, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLogEntry, Doc, Task, WorkspaceSchool } from "@/lib/types";
import { cn, formatDate, formatRelative, isoDay } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_GREEN = "#0E8A6B";
const HEAT_RAMP = ["#EDEBE3", "#D6E8E2", "#A8CEC3", "#3E8A76", "#175E54"];

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me, members, memberById } = useWorkspace();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [schools, setSchools] = useState<WorkspaceSchool[]>([]);
  const [feed, setFeed] = useState<ActivityLogEntry[]>([]);

  async function load() {
    const [{ data: t }, { data: d }, { data: s }, { data: f }] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id),
      supabase.from("documents").select("id, type, title, status, metadata, updated_at").eq("workspace_id", workspace.id).is("deleted_at", null),
      supabase.from("workspace_schools").select("*, school:schools(*)").eq("workspace_id", workspace.id),
      supabase.from("activity_log").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(200),
    ]);
    setTasks(t ?? []);
    setDocs((d as any) ?? []);
    setSchools((s as any) ?? []);
    setFeed(f ?? []);
  }

  useEffect(() => {
    supabase.rpc("sweep_missed_tasks", { ws: workspace.id }).then(() => load());
    const channel = supabase
      .channel(`dash:${workspace.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log", filter: `workspace_id=eq.${workspace.id}` }, (p) =>
        setFeed((prev) => [p.new as ActivityLogEntry, ...prev].slice(0, 200))
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspace.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  if (tasks === null)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  const today = isoDay();
  const base = `/w/${workspace.id}`;
  const doneTasks = tasks.filter((t) => t.status === "done");
  const overdue = tasks.filter((t) => t.status === "missed" || (t.status !== "done" && t.due_date && t.due_date < today));
  const myToday = tasks.filter(
    (t) => t.assigned_to === me.id && t.status !== "done" && t.due_date && t.due_date <= today
  );

  // Completion rate over the last 30 days (cumulative % of all tasks done)
  const chartData = (() => {
    const days: { day: string; label: string; pct: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIso = isoDay(d);
      const created = tasks.filter((t) => t.created_at.slice(0, 10) <= dayIso).length;
      const done = tasks.filter((t) => t.completed_at && t.completed_at.slice(0, 10) <= dayIso).length;
      days.push({
        day: dayIso,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pct: created ? Math.round((done / created) * 100) : 0,
      });
    }
    return days;
  })();

  // Per-person streak: consecutive days (ending today/yesterday) with any logged action
  const streaks = members.map((m) => {
    const daysActive = new Set(
      feed.filter((f) => f.actor_id === m.user_id).map((f) => f.created_at.slice(0, 10))
    );
    let streak = 0;
    const cursor = new Date();
    if (!daysActive.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1); // grace for today
    while (daysActive.has(isoDay(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { member: m, streak };
  });

  // 12-week activity heatmap from the feed
  const heat = (() => {
    const counts = new Map<string, number>();
    feed.forEach((f) => {
      const k = f.created_at.slice(0, 10);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const weeks: { day: string; count: number }[][] = [];
    const start = new Date();
    start.setDate(start.getDate() - 7 * 12 + 1);
    start.setDate(start.getDate() - start.getDay()); // align to Sunday
    for (let w = 0; w < 12; w++) {
      const week: { day: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        const k = isoDay(cur);
        week.push({ day: k, count: k <= today ? (counts.get(k) ?? 0) : -1 });
      }
      weeks.push(week);
    }
    return weeks;
  })();
  const heatColor = (c: number) =>
    c < 0 ? "transparent" : HEAT_RAMP[Math.min(c === 0 ? 0 : Math.ceil(c / 3), 4)];

  // Upcoming school deadlines
  const deadlines = schools
    .flatMap((s) =>
      (
        [
          ["ED", s.ed_deadline],
          ["EA", s.ea_deadline],
          ["RD", s.rd_deadline],
        ] as const
      )
        .filter(([, d]) => d && d >= today)
        .map(([kind, d]) => ({ kind, date: d!, school: s }))
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const componentStats = [
    { label: "Essay", href: `${base}/essay`, items: docs.filter((d) => d.type === "essay") },
    { label: "Activities", href: `${base}/activities`, items: docs.filter((d) => d.type === "activity") },
    { label: "Recommenders", href: `${base}/recommenders`, items: docs.filter((d) => d.type === "recommender") },
    { label: "Extras", href: `${base}/extras`, items: docs.filter((d) => d.type === "extra") },
    { label: "Supplementals", href: `${base}/schools`, items: docs.filter((d) => d.type === "supplemental") },
  ];

  async function completeTask(t: Task) {
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-semibold">{workspace.name}</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        Shared progress — everyone in this workspace sees the same picture.
      </p>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Tasks completed",
            value: `${doneTasks.length}/${tasks.length || 0}`,
            sub: tasks.length ? `${Math.round((doneTasks.length / tasks.length) * 100)}% done` : "No tasks yet",
          },
          {
            label: "Overdue",
            value: String(overdue.length),
            sub: overdue.length ? "Needs attention" : "All clear",
            danger: overdue.length > 0,
          },
          {
            label: "Schools complete",
            value: `${schools.filter((s) => s.status === "complete").length}/${schools.length}`,
            sub: `${docs.filter((d) => d.type === "supplemental").length} supplemental drafts`,
          },
          {
            label: "Documents final",
            value: `${docs.filter((d) => d.status === "final").length}/${docs.length}`,
            sub: `${docs.filter((d) => d.status === "in_review").length} in review`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-paper-line bg-paper-raised p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{s.label}</p>
            <p className={cn("mt-1 font-display text-3xl font-semibold tabular-nums", s.danger && "text-clay-600")}>
              {s.value}
            </p>
            <p className={cn("mt-0.5 text-xs", s.danger ? "text-clay-600" : "text-ink-faint")}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {/* Due today */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              Your checklist for today
            </h2>
            {myToday.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Nothing due today.{" "}
                <Link href={`${base}/tasks`} className="text-pine-600 hover:underline">
                  Pick a suggested task →
                </Link>
              </p>
            ) : (
              <div className="space-y-1.5">
                {myToday.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-paper-sunken">
                    <input type="checkbox" className="h-4 w-4 accent-pine-600" onChange={() => completeTask(t)} />
                    <span className="flex-1 text-sm">{t.title}</span>
                    {t.due_date! < today && <span className="text-[11px] font-semibold text-clay-600">overdue</span>}
                    {t.estimated_minutes && <span className="text-[11px] text-ink-faint">~{t.estimated_minutes}m</span>}
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Completion rate */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              Task completion rate — last 30 days
            </h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="fillDone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_GREEN} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={CHART_GREEN} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E0DDD2" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7C837B" }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: "#7C837B" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: any) => [`${v}%`, "Completed"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #E0DDD2", fontSize: 12, background: "#FDFCF9" }}
                  />
                  <Area type="monotone" dataKey="pct" stroke={CHART_GREEN} strokeWidth={2} fill="url(#fillDone)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Heatmap + streaks */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              Workspace activity — last 12 weeks
            </h2>
            <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label="Calendar heatmap of workspace activity">
              {heat.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((cell) => (
                    <div
                      key={cell.day}
                      title={cell.count >= 0 ? `${cell.day}: ${cell.count} action${cell.count === 1 ? "" : "s"}` : ""}
                      className="h-3.5 w-3.5 rounded-[3px]"
                      style={{ backgroundColor: heatColor(cell.count) }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-paper-line pt-3">
              {streaks.map(({ member, streak }) => (
                <div key={member.user_id} className="flex items-center gap-2">
                  <Avatar profile={member.profile} size={26} />
                  <div>
                    <p className="text-xs font-medium">{member.profile?.display_name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {streak > 0 ? `🔥 ${streak}-day streak` : "No current streak"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-6">
          {/* Deadlines */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              School deadlines
            </h2>
            {deadlines.length === 0 ? (
              <p className="text-sm text-ink-faint">
                No upcoming deadlines.{" "}
                <Link href={`${base}/schools`} className="text-pine-600 hover:underline">
                  Set them per school →
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {deadlines.map((d, i) => {
                  const daysLeft = Math.ceil((new Date(d.date).getTime() - Date.now()) / 86400000);
                  return (
                    <Link
                      key={i}
                      href={`${base}/schools/${d.school.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-paper-sunken"
                    >
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                          d.kind === "ED" ? "bg-clay-100 text-clay-600" : d.kind === "EA" ? "bg-marigold-100 text-marigold-600" : "bg-pine-100 text-pine-700"
                        )}
                      >
                        {d.kind}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{d.school.school?.name}</span>
                      <span className={cn("text-xs tabular-nums", daysLeft <= 7 ? "font-semibold text-clay-600" : "text-ink-faint")}>
                        {formatDate(d.date)} · {daysLeft}d
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Component progress */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              Application components
            </h2>
            <div className="space-y-2.5">
              {componentStats.map((c) => {
                const finals = c.items.filter((d) => d.status === "final").length;
                return (
                  <Link key={c.label} href={c.href} className="block rounded-lg px-2 py-1.5 hover:bg-paper-sunken">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-xs text-ink-faint">
                        {c.items.length === 0 ? "Not started" : `${finals}/${c.items.length} final`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                      <div
                        className="h-full rounded-full bg-pine-500 transition-[width]"
                        style={{ width: c.items.length ? `${(finals / c.items.length) * 100}%` : "0%" }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Live activity feed */}
          <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
              Recent activity
            </h2>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {feed.length === 0 && <p className="text-sm text-ink-faint">Actions across the workspace show up here automatically.</p>}
              {feed.slice(0, 40).map((f) => (
                <div key={f.id} className="flex items-start gap-2.5">
                  <Avatar profile={memberById(f.actor_id)} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{f.summary}</p>
                    <p className="text-[11px] text-ink-faint">{formatRelative(f.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
