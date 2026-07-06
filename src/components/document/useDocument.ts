"use client";

import { createClient } from "@/lib/supabase/client";
import type { Comment, Doc, DocVersion } from "@/lib/types";
import { wordCountOf } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Loads a document plus its versions/comments, autosaves content
 * (debounced), and keeps everything live via Supabase Realtime.
 * Concurrency model: last-write-wins on current_content; remote updates are
 * surfaced via `remoteContent` so the editor can apply them when not typing.
 */
export function useDocument(documentId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [saving, setSaving] = useState(false);
  const [remoteContent, setRemoteContent] = useState<{ content: any; ts: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalSave = useRef<number>(0);

  const reload = useCallback(async () => {
    const [{ data: d }, { data: v }, { data: c }] = await Promise.all([
      supabase.from("documents").select("*").eq("id", documentId).single(),
      supabase
        .from("document_versions")
        .select("*, author:profiles(*)")
        .eq("document_id", documentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("*, author:profiles(*)")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true }),
    ]);
    setDoc(d);
    setVersions((v as any) ?? []);
    setComments((c as any) ?? []);
  }, [supabase, documentId]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`doc:${documentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "documents", filter: `id=eq.${documentId}` },
        (payload) => {
          const next = payload.new as Doc;
          setDoc((prev) => {
            // Ignore echoes of our own recent save
            if (Date.now() - lastLocalSave.current > 1500) {
              setRemoteContent({ content: next.current_content, ts: Date.now() });
            }
            return { ...prev, ...next } as Doc;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `document_id=eq.${documentId}` },
        () => {
          supabase
            .from("comments")
            .select("*, author:profiles(*)")
            .eq("document_id", documentId)
            .order("created_at", { ascending: true })
            .then(({ data }) => setComments((data as any) ?? []));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_versions", filter: `document_id=eq.${documentId}` },
        () => {
          supabase
            .from("document_versions")
            .select("*, author:profiles(*)")
            .eq("document_id", documentId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .then(({ data }) => setVersions((data as any) ?? []));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, documentId, reload]);

  /** Debounced autosave of the working copy (does NOT create a version). */
  const saveContent = useCallback(
    (content: any) => {
      setDoc((prev) => (prev ? { ...prev, current_content: content } : prev));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(async () => {
        lastLocalSave.current = Date.now();
        await supabase.from("documents").update({ current_content: content }).eq("id", documentId);
        setSaving(false);
      }, 900);
    },
    [supabase, documentId]
  );

  const updateDoc = useCallback(
    async (patch: Partial<Doc>) => {
      setDoc((prev) => (prev ? { ...prev, ...patch } : prev));
      lastLocalSave.current = Date.now();
      await supabase.from("documents").update(patch).eq("id", documentId);
    },
    [supabase, documentId]
  );

  /** Snapshot the current content into the version library. */
  const saveVersion = useCallback(
    async (opts: { label?: string; coverUrl?: string; authorId: string; content?: any }) => {
      const content = opts.content ?? doc?.current_content;
      if (!content) return { error: new Error("Nothing to snapshot yet — write something first.") };
      const { error } = await supabase.from("document_versions").insert({
        document_id: documentId,
        content,
        author_id: opts.authorId,
        version_label: opts.label || null,
        cover_image_url: opts.coverUrl || null,
        word_count: wordCountOf(content),
      });
      return { error };
    },
    [supabase, documentId, doc?.current_content]
  );

  /** Restore: snapshot current state first (nothing lost), then swap content. */
  const restoreVersion = useCallback(
    async (version: DocVersion, authorId: string) => {
      if (doc?.current_content && wordCountOf(doc.current_content) > 0) {
        await supabase.from("document_versions").insert({
          document_id: documentId,
          content: doc.current_content,
          author_id: authorId,
          version_label: "Auto-saved before restore",
          word_count: wordCountOf(doc.current_content),
        });
      }
      lastLocalSave.current = 0; // let the update flow back into the editor
      await supabase
        .from("documents")
        .update({ current_content: version.content })
        .eq("id", documentId);
      setRemoteContent({ content: version.content, ts: Date.now() });
      setDoc((prev) => (prev ? { ...prev, current_content: version.content } : prev));
    },
    [supabase, documentId, doc?.current_content]
  );

  const softDeleteVersion = useCallback(
    async (versionId: string) => {
      await supabase
        .from("document_versions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", versionId);
    },
    [supabase]
  );

  return {
    doc,
    versions,
    comments,
    saving,
    remoteContent,
    saveContent,
    updateDoc,
    saveVersion,
    restoreVersion,
    softDeleteVersion,
    reload,
  };
}
