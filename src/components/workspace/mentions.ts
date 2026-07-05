import type { Member } from "@/lib/types";

/** Find member user_ids mentioned as @Name (first name or full display name) in text. */
export function parseMentions(text: string, members: Member[]): string[] {
  const ids = new Set<string>();
  for (const m of members) {
    const name = m.profile?.display_name;
    if (!name) continue;
    const first = name.split(/\s+/)[0];
    const pattern = new RegExp(
      `@(${escapeRe(name)}|${escapeRe(first)})(?=$|[^\\w])`,
      "i"
    );
    if (pattern.test(text)) ids.add(m.user_id);
  }
  return Array.from(ids);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Render @mentions with emphasis; returns HTML-safe React-ready segments. */
export function splitMentionSegments(text: string): { text: string; mention: boolean }[] {
  const out: { text: string; mention: boolean }[] = [];
  const re = /@[\w][\w .'-]*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}
