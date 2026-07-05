"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ExtraDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const { workspace } = useWorkspace();
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/w/${workspace.id}/extras`}
        className="no-print mb-2 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← Extras &amp; Context
      </Link>
      <DocumentWorkbench documentId={docId} wordLimit={650} placeholder="Write the context colleges should have…" />
    </div>
  );
}
