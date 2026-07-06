"use client";

import { Input, Spinner, StatusPill } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { Comment, Doc } from "@/lib/types";
import { formatRelative, tiptapText } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TYPE_LABEL: Record<string, string> = {
  essay: "Essay",
  activity: "Activity",
  recommender: "Recommender",
  extra: "Extras & Context",
  supplemental: "Supplemental",
};

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace, memberById } = useWorkspace();
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase
        .from("documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null);
      const ids = (d ?? []).map((x) => x.id);
      const { data: c } = ids.length
        ? await supabase.from("comments").select("*").in("document_id", ids)
        : { data: [] };
      setDocs(d ?? []);
      setComments(c ?? []);
    })();
  }, [supabase, workspace.id]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q || !docs) return null;
    const docHits = docs
      .map((d) => {
        const text = `${d.title} ${d.metadata.question ?? ""} ${d.metadata.description ?? ""} ${d.metadata.position ?? ""} ${tiptapText(d.current_content)}`.toLowerCase();
        const idx = text.indexOf(q);
        if (idx < 0) return null;
        const plain = tiptapText(d.current_content);
        const pIdx = plain.toLowerCase().indexOf(q);
        const snippet =
          pIdx >= 0
            ? `…${plain.slice(Math.max(0, pIdx - 60), pIdx + q.length + 60)}…`
            : plain.slice(0, 120);
        return { doc: d, snippet };
      })
      .filter(Boolean) as { doc: Doc; snippet: string }[];
    const commentHits = comments.filter((c) => c.content.toLowerCase().includes(q));
    return { docHits, commentHits };
  }, [q, docs, comments]);

  function docHref(d: Doc) {
    const base = `/w/${workspace.id}`;
    switch (d.type) {
      case "essay":
        return `${base}/essay/${d.id}`;
      case "activity":
        return `${base}/activities/${d.id}`;
      case "recommender":
        return `${base}/recommenders/${d.id}`;
      case "extra":
        return `${base}/extras/${d.id}`;
      case "supplemental":
        return `${base}/supplementals/${d.id}`;
    }
  }

  function highlight(text: string) {
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded-sm bg-marigold-200 px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-semibold">Search everything</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        Essays, activities, brag sheets, supplemental answers, and comments.
      </p>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the whole workspace…"
        className="mt-5 !py-3 text-base"
        aria-label="Search workspace"
      />

      {docs === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !q ? (
        <p className="mt-10 text-center text-sm text-ink-faint">Type to search across every document in the workspace.</p>
      ) : results && results.docHits.length + results.commentHits.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-faint">No matches for “{query}”.</p>
      ) : (
        results && (
          <div className="mt-8 space-y-8">
            {results.docHits.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
                  Documents ({results.docHits.length})
                </h2>
                <div className="space-y-2">
                  {results.docHits.map(({ doc, snippet }) => (
                    <Link
                      key={doc.id}
                      href={docHref(doc)!}
                      className="block rounded-card border border-paper-line bg-paper-raised p-4 shadow-card hover:shadow-lift"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-pine-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine-700">
                          {TYPE_LABEL[doc.type]}
                        </span>
                        <p className="min-w-0 flex-1 truncate font-semibold">{highlight(doc.title)}</p>
                        <StatusPill status={doc.status} />
                      </div>
                      {snippet && <p className="mt-1.5 text-sm text-ink-soft">{highlight(snippet)}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {results.commentHits.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
                  Comments ({results.commentHits.length})
                </h2>
                <div className="space-y-2">
                  {results.commentHits.map((c) => {
                    const doc = docs.find((d) => d.id === c.document_id);
                    return (
                      <Link
                        key={c.id}
                        href={doc ? docHref(doc)! : "#"}
                        className="block rounded-card border border-paper-line bg-paper-raised p-4 shadow-card hover:shadow-lift"
                      >
                        <p className="text-sm">{highlight(c.content)}</p>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {memberById(c.author_id)?.display_name} on “{doc?.title}” · {formatRelative(c.created_at)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}
