"use client";

import { SchoolLogo } from "@/components/schools/SchoolLogo";
import { Button, Chip, EmptyState, Input, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { School, WorkspaceSchool } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function SchoolsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const [mine, setMine] = useState<WorkspaceSchool[] | null>(null);
  const [directory, setDirectory] = useState<School[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function loadMine() {
    const { data } = await supabase
      .from("workspace_schools")
      .select("*, school:schools(*)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });
    setMine((data as any) ?? []);
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  // Directory search (or top schools by enrollment when idle)
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let req = supabase.from("schools").select("*").order("enrollment", { ascending: false }).limit(24);
      if (query.trim()) req = req.ilike("name", `%${query.trim()}%`);
      const { data } = await req;
      if (!cancelled) {
        setDirectory(data ?? []);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [supabase, query]);

  async function addSchool(school: School) {
    await supabase.from("workspace_schools").insert({
      workspace_id: workspace.id,
      school_id: school.id,
      added_by: me.id,
    });
    loadMine();
  }

  const myIds = new Set((mine ?? []).map((m) => m.school_id));

  if (mine === null)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-semibold">Schools &amp; Supplementals</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        Build the school list, track deadlines, and draft every supplemental question — data from
        the U.S. Dept. of Education College Scorecard.
      </p>

      {/* My list */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
          My list ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <EmptyState title="No schools on the list yet" hint="Search the directory below and add schools to start their supplemental workspaces." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((ws, i) => (
              <motion.div key={ws.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link
                  href={`/w/${workspace.id}/schools/${ws.id}`}
                  className="block h-full rounded-card border border-paper-line bg-paper-raised p-4 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-start gap-3">
                    <SchoolLogo school={ws.school!} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ws.school!.name}</p>
                      <p className="text-xs text-ink-faint">
                        {ws.school!.city}, {ws.school!.state}
                      </p>
                    </div>
                    <StatusPill status={ws.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-ink-soft">
                    {ws.ed_deadline && <Chip>ED {formatDate(ws.ed_deadline)}</Chip>}
                    {ws.ea_deadline && <Chip>EA {formatDate(ws.ea_deadline)}</Chip>}
                    {ws.rd_deadline && <Chip>RD {formatDate(ws.rd_deadline)}</Chip>}
                    {!ws.ed_deadline && !ws.ea_deadline && !ws.rd_deadline && (
                      <span className="text-ink-faint">No deadlines set</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Directory */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">Directory</h2>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 500 US colleges…"
            className="!w-64"
            aria-label="Search schools"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {directory.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className="flex flex-col rounded-card border border-paper-line bg-paper-raised p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <SchoolLogo school={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" title={s.name}>
                    {s.name}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {s.city}, {s.state}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.ownership && <Chip>{s.ownership}</Chip>}
                {s.admission_rate != null && <Chip>{Math.round(s.admission_rate * 100)}% admit</Chip>}
                {s.enrollment != null && <Chip>{s.enrollment.toLocaleString()} students</Chip>}
              </div>
              <div className="mt-auto pt-3">
                {myIds.has(s.id) ? (
                  <span className="text-xs font-medium text-pine-600">✓ On the list</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => addSchool(s)}>
                    + Add to list
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
          {searching && directory.length === 0 && (
            <div className="col-span-full flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {!searching && directory.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-ink-faint">
              No schools match “{query}”. The directory seeds the 500 largest US bachelor&apos;s
              institutions — see the README to extend it.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
