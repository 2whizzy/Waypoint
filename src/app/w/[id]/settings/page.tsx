"use client";

import { Avatar, Button, Input, Label, Modal, Select, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Doc, DocVersion } from "@/lib/types";
import { formatDate, formatRelative } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const FREE_TIER_STORAGE_MB = 1024; // Supabase free tier: 1 GB storage

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, members, me, myRole, refreshMembers } = useWorkspace();
  const isOwner = workspace.student_id === me.id;

  const [name, setName] = useState(workspace.name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("helper");
  const [invites, setInvites] = useState<any[]>([]);
  const [trash, setTrash] = useState<Doc[] | null>(null);
  const [trashVersions, setTrashVersions] = useState<DocVersion[]>([]);
  const [storageMb, setStorageMb] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  async function loadInvites() {
    const { data } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("status", "pending");
    setInvites(data ?? []);
  }

  async function loadTrash() {
    const [{ data: docs }, { data: allDocs }] = await Promise.all([
      supabase.from("documents").select("*").eq("workspace_id", workspace.id).not("deleted_at", "is", null),
      supabase.from("documents").select("id").eq("workspace_id", workspace.id),
    ]);
    setTrash((docs as any) ?? []);
    const ids = (allDocs ?? []).map((d) => d.id);
    if (ids.length) {
      const { data: vers } = await supabase
        .from("document_versions")
        .select("*")
        .in("document_id", ids)
        .not("deleted_at", "is", null);
      setTrashVersions((vers as any) ?? []);
    }
  }

  async function loadStorage() {
    let total = 0;
    for (const bucket of ["files", "covers"]) {
      const { data } = await supabase.storage.from(bucket).list(workspace.id, { limit: 100 });
      for (const entry of data ?? []) {
        if (entry.metadata?.size) total += entry.metadata.size;
        else {
          // one level of nesting (files/{ws}/{doc}/file)
          const { data: nested } = await supabase.storage
            .from(bucket)
            .list(`${workspace.id}/${entry.name}`, { limit: 100 });
          for (const f of nested ?? []) total += f.metadata?.size ?? 0;
        }
      }
    }
    setStorageMb(total / (1024 * 1024));
  }

  useEffect(() => {
    loadInvites();
    loadTrash();
    loadStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("workspaces").update({ name }).eq("id", workspace.id);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("workspace_invites").insert({
      workspace_id: workspace.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: me.id,
    });
    setInviteEmail("");
    loadInvites();
  }

  async function revokeInvite(id: string) {
    await supabase.from("workspace_invites").delete().eq("id", id);
    loadInvites();
  }

  async function removeMember(userId: string) {
    await supabase.from("workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", userId);
    setConfirmRemove(null);
    refreshMembers();
  }

  async function restoreDoc(id: string) {
    await supabase.from("documents").update({ deleted_at: null }).eq("id", id);
    loadTrash();
  }

  async function restoreVersion(id: string) {
    await supabase.from("document_versions").update({ deleted_at: null }).eq("id", id);
    loadTrash();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Workspace settings</h1>
        <p className="mt-0.5 text-sm text-ink-soft">Collaborators, invites, trash, and housekeeping.</p>
      </div>

      {/* Rename */}
      <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">Workspace name</h2>
        <form onSubmit={rename} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
          {isOwner && <Button type="submit">{savedNote ? "Saved ✓" : "Save"}</Button>}
        </form>
        {!isOwner && <p className="mt-2 text-xs text-ink-faint">Only the student can rename the workspace.</p>}
      </section>

      {/* Members */}
      <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
          Collaborators ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <Avatar profile={m.profile} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.profile?.display_name} {m.user_id === me.id && <span className="text-ink-faint">(you)</span>}
                </p>
                <p className="text-xs text-ink-faint">{m.profile?.email}</p>
              </div>
              <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
                {m.role}
              </span>
              {isOwner && m.user_id !== me.id && (
                <button className="text-xs text-clay-600 hover:underline" onClick={() => setConfirmRemove(m.user_id)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">Invite by email</h3>
        <form onSubmit={sendInvite} className="flex flex-wrap gap-2">
          <Input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="helper@example.com"
            className="!w-64"
          />
          <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="!w-auto">
            <option value="helper">Helper / counselor</option>
            <option value="student">Student</option>
          </Select>
          <Button type="submit">Send invite</Button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">
          When they sign up (or next sign in) with this email, they join automatically.
        </p>
        {invites.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 text-sm">
                <span className="text-ink-soft">{inv.email}</span>
                <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[10px] font-medium text-marigold-600">
                  pending · {inv.role}
                </span>
                <button className="text-xs text-clay-600 hover:underline" onClick={() => revokeInvite(inv.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Storage */}
      <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
          Storage (Supabase free tier)
        </h2>
        {storageMb === null ? (
          <Spinner />
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-paper-sunken">
              <div
                className="h-full rounded-full bg-pine-500"
                style={{ width: `${Math.min(100, (storageMb / FREE_TIER_STORAGE_MB) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              ~{storageMb.toFixed(1)} MB of {FREE_TIER_STORAGE_MB.toLocaleString()} MB used by this
              workspace&apos;s uploads (covers + attached files). The free tier also caps the database at
              500 MB — text content barely dents it.
            </p>
          </>
        )}
      </section>

      {/* Trash */}
      <section className="rounded-card border border-paper-line bg-paper-raised p-5 shadow-card">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
          Trash — nothing is ever truly lost
        </h2>
        {trash === null ? (
          <Spinner />
        ) : trash.length === 0 && trashVersions.length === 0 ? (
          <p className="text-sm text-ink-faint">Empty. Deleted documents and versions land here for restoring.</p>
        ) : (
          <div className="space-y-2">
            {trash.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg bg-paper px-3 py-2">
                <span className="text-xs uppercase text-ink-faint">{d.type}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                <span className="text-[11px] text-ink-faint">deleted {formatRelative(d.deleted_at!)}</span>
                <Button size="sm" variant="secondary" onClick={() => restoreDoc(d.id)}>
                  Restore
                </Button>
              </div>
            ))}
            {trashVersions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg bg-paper px-3 py-2">
                <span className="text-xs uppercase text-ink-faint">version</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {v.version_label || `Version · ${formatDate(v.created_at)}`} ({v.word_count}w)
                </span>
                <Button size="sm" variant="secondary" onClick={() => restoreVersion(v.id)}>
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Remove collaborator?">
        <p className="text-sm text-ink-soft">
          They lose access to this workspace immediately. Their edits, comments, and versions remain
          attributed to them.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => confirmRemove && removeMember(confirmRemove)}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
