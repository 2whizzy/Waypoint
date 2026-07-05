"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

export default function EssayPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, me } = useWorkspace();
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("type", "essay")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing) {
        setDocId(existing.id);
        return;
      }
      const { data: created } = await supabase
        .from("documents")
        .insert({
          workspace_id: workspace.id,
          type: "essay",
          title: "Personal Essay",
          created_by: me.id,
        })
        .select("id")
        .single();
      if (created) setDocId(created.id);
    })();
  }, [supabase, workspace.id, me.id]);

  if (!docId) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="no-print mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-pine-600">
        Personal essay
      </p>
      <DocumentWorkbench
        documentId={docId}
        wordLimit={650}
        placeholder="Begin the story only you can tell…"
      />
      <p className="no-print mt-6 text-xs text-ink-faint">
        650 words is the Common App reference limit — the counter flags it but never blocks or cuts
        your writing.
      </p>
    </div>
  );
}
