"use client";

import { createClient } from "@/lib/supabase/client";
import type { Member, Profile, Workspace } from "@/lib/types";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface PresenceEntry {
  user_id: string;
  path: string;
  display_name: string;
  color: string;
}

interface WorkspaceCtx {
  workspace: Workspace;
  members: Member[];
  me: Profile;
  myRole: string;
  presence: PresenceEntry[];
  memberById: (id: string | null | undefined) => Profile | undefined;
  refreshMembers: () => Promise<void>;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}

export function WorkspaceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshMembers = useCallback(async () => {
    const { data } = await supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", workspaceId);
    setMembers((data as any) ?? []);
  }, [supabase, workspaceId]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: ws }, { data: profile }] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);
      setWorkspace(ws);
      setMe(profile);
      await refreshMembers();
    })();
  }, [supabase, workspaceId, refreshMembers]);

  // Presence: track who's on which page
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel(`presence:${workspaceId}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceEntry>();
        setPresence(Object.values(state).map((entries) => entries[0]));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: me.id,
            path: pathname,
            display_name: me.display_name,
            color: me.color,
          });
        }
      });
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, workspaceId, me?.id]);

  // Update tracked path on navigation
  useEffect(() => {
    if (channelRef.current && me) {
      channelRef.current.track({
        user_id: me.id,
        path: pathname,
        display_name: me.display_name,
        color: me.color,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const memberById = useCallback(
    (id: string | null | undefined) => members.find((m) => m.user_id === id)?.profile,
    [members]
  );

  if (!workspace || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pine-200 border-t-pine-600" />
      </div>
    );
  }

  const myRole = members.find((m) => m.user_id === me.id)?.role ?? "helper";

  return (
    <Ctx.Provider value={{ workspace, members, me, myRole, presence, memberById, refreshMembers }}>
      {children}
    </Ctx.Provider>
  );
}
