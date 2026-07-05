"use client";

import { createClient } from "@/lib/supabase/client";
import { Avatar, Button, EmptyState, Input, Label, Modal, Spinner } from "@/components/ui";
import type { Profile, Workspace } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type WsRow = Workspace & { members: Profile[]; role: string };

export default function WorkspacesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState<WsRow[] | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.rpc("accept_my_invites");
      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id),
      ]);
      setMe(profile);
      const ids = (memberships ?? []).map((m) => m.workspace_id);
      if (!ids.length) {
        setRows([]);
        return;
      }
      const { data: workspaces } = await supabase.from("workspaces").select("*").in("id", ids);
      const { data: allMembers } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, profile:profiles(*)")
        .in("workspace_id", ids);
      setRows(
        (workspaces ?? []).map((w) => ({
          ...w,
          role: (memberships ?? []).find((m) => m.workspace_id === w.id)?.role ?? "helper",
          members: (allMembers ?? [])
            .filter((m) => m.workspace_id === w.id)
            .map((m: any) => m.profile),
        }))
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: id, error } = await supabase.rpc("create_workspace", { ws_name: name });
    setBusy(false);
    if (!error && id) router.push(`/w/${id}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pine-600">Waypoint</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Your workspaces</h1>
        </div>
        <div className="flex items-center gap-3">
          {me && <Avatar profile={me} size={34} />}
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          hint="A workspace holds one student's entire application — essays, activities, recommenders, supplementals, and tasks. Create one, or ask the student to invite you by email."
          action={<Button onClick={() => setCreating(true)}>Create a workspace</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Link
                  href={`/w/${w.id}`}
                  className="block rounded-card border border-paper-line bg-paper-raised p-5 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-start justify-between">
                    <h2 className="font-display text-xl font-semibold">{w.name}</h2>
                    <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
                      {w.role}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">Created {formatDate(w.created_at)}</p>
                  <div className="mt-4 flex -space-x-1.5">
                    {w.members.map((m) => (
                      <Avatar key={m.id} profile={m} size={26} className="ring-2 ring-paper-raised" />
                    ))}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="mt-8">
            <Button variant="secondary" onClick={() => setCreating(true)}>
              + New workspace
            </Button>
          </div>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New workspace">
        <form onSubmit={createWorkspace} className="space-y-4">
          <div>
            <Label>Workspace name</Label>
            <Input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fikir's College Application"
            />
          </div>
          <p className="text-xs text-ink-faint">
            You&apos;ll be the <strong>student</strong> in this workspace. Invite helpers and counselors
            from Settings once it&apos;s created.
          </p>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </Modal>
    </main>
  );
}
