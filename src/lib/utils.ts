import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Extract plain text from Tiptap JSON content */
export function tiptapText(content: any): string {
  if (!content) return "";
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === "text" && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      if (node.type !== "doc") parts.push("\n");
    }
  };
  walk(content);
  return parts.join("").replace(/\n+/g, "\n").trim();
}

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function wordCountOf(content: any): number {
  return countWords(tiptapText(content));
}

/** Word-level LCS diff for the version compare view */
export type DiffPart = { text: string; kind: "same" | "added" | "removed" };

export function diffWords(a: string, b: string): DiffPart[] {
  const aw = a.split(/(\s+)/).filter((w) => w.length);
  const bw = b.split(/(\s+)/).filter((w) => w.length);
  const n = aw.length;
  const m = bw.length;
  // cap to keep O(n*m) sane on long essays
  if (n * m > 4_000_000) {
    return [
      { text: a, kind: "removed" },
      { text: b, kind: "added" },
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const parts: DiffPart[] = [];
  let i = 0,
    j = 0;
  const push = (text: string, kind: DiffPart["kind"]) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      push(aw[i], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(aw[i], "removed");
      i++;
    } else {
      push(bw[j], "added");
      j++;
    }
  }
  while (i < n) push(aw[i++], "removed");
  while (j < m) push(bw[j++], "added");
  return parts;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatRelative(d: string | Date): string {
  const date = new Date(d);
  const secs = (Date.now() - date.getTime()) / 1000;
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 7) return `${Math.floor(secs / 86400)}d ago`;
  return formatDate(date);
}

/** Local YYYY-MM-DD (for date columns; avoids UTC off-by-one) */
export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function schoolLogoUrl(domain: string | null): string | null {
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}
