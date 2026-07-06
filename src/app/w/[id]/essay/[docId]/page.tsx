"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EssayDraftPage() {
  const { docId } = useParams<{ docId: string }>();
  const { workspace } = useWorkspace();
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/w/${workspace.id}/essay`}
        className="no-print mb-2 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-pine-600 hover:underline"
      >
        ← All essay drafts
      </Link>
      <DocumentWorkbench
        documentId={docId}
        wordLimit={650}
        placeholder="Begin the story only you can tell…"
      />
    </div>
  );
}
