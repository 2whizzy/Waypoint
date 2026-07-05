"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Input, Label, Select, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { RecommenderMeta } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function RecommenderDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { workspace } = useWorkspace();
  const [meta, setMeta] = useState<RecommenderMeta | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase
      .from("documents")
      .select("metadata")
      .eq("id", docId)
      .single()
      .then(({ data }) => setMeta((data?.metadata as RecommenderMeta) ?? {}));
  }, [supabase, docId]);

  function patch(p: Partial<RecommenderMeta>) {
    setMeta((prev) => {
      const next = { ...(prev ?? {}), ...p };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        supabase.from("documents").update({ metadata: next }).eq("id", docId).then();
      }, 700);
      return next;
    });
  }

  if (!meta)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  const form = (
    <div className="no-print mb-6 grid gap-4 rounded-card border border-paper-line bg-paper-raised p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Label>Relationship</Label>
        <Input value={meta.relationship ?? ""} onChange={(e) => patch({ relationship: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={meta.email ?? ""} onChange={(e) => patch({ email: e.target.value })} />
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={meta.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={meta.pipeline ?? "not_asked"} onChange={(e) => patch({ pipeline: e.target.value as any })}>
          <option value="not_asked">Not yet asked</option>
          <option value="asked">Asked</option>
          <option value="confirmed">Confirmed</option>
          <option value="submitted">Submitted</option>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/w/${workspace.id}/recommenders`}
        className="no-print mb-2 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← Recommenders
      </Link>
      <DocumentWorkbench
        documentId={docId}
        headerExtra={form}
        placeholder="Brag sheet: stories, projects, moments this recommender should mention. Attach your resume in Resources."
      />
    </div>
  );
}
