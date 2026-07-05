# Waypoint — build the application, together

A private, multi-user workspace for collaboratively building one student's college
application (Common App style). A student and their helpers/counselors draft the essay,
shape the activities list, track recommenders, write per-school supplementals, and hold
each other accountable — with live presence, realtime sync, full version history on
everything, inline comments, and a shared task/analytics system.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Realtime, Storage) ·
Tailwind CSS · Framer Motion · Tiptap · dnd-kit · Recharts. Everything fits Supabase and
Vercel free tiers.

---

## Feature map

| Area | What's there |
|---|---|
| **Workspaces** | One workspace = one student's application. Roles (student / helper), invite-by-email (joins automatically on signup/login), settings page with rename, member management, storage meter, and a Trash that restores soft-deleted documents & versions. |
| **Essay** | Tiptap editor (bold/italic/underline, H2/H3, lists, highlighter), live word counter with a **non-blocking** 650-word reference limit (green → amber → red, never truncates), inline comments anchored to exact text selections, threaded replies, resolve/reopen, version library as a card gallery (cover image, title, author, word count), side-by-side compare with word-level diff, restore (auto-snapshots current work first), resources panel (links/notes/files). |
| **Activities** | Real Common App data shape (30 official categories, position ≤50 chars, description ≤150 chars, grade levels, hrs/week, wks/year, continue-in-college) with **no 10-slot cap**. Each activity is a full document (versions/comments/resources) with an expanded working draft plus the final description with a live char counter. Drag-and-drop ranking (persisted), ranked-list ↔ card-library toggle, student-defined color tags, per-activity mini checklist, search/filter by text/category/status/tag. |
| **Recommenders** | Card per recommender with a 4-stage pipeline (not asked → asked → confirmed → submitted), contact info, and a brag-sheet document with the full comment/version/resource system. |
| **Extras & Context** | Free-form documents (Additional Info, arts supplement, circumstances…) with the same engine. |
| **Schools & Supplementals** | Directory of **500 real US colleges** (College Scorecard data: ownership, admit rate, enrollment; Clearbit logos with monogram fallback). Per-school workspace: ED/EA/RD deadlines, status, notes, and one document per supplemental question with its own stated limit (words or chars, informational only). **Cross-import** pulls any existing answer — current draft or any saved version, from any school or the main essay — in as a clearly-labeled new version. |
| **Tasks & accountability** | Auto-suggested tasks computed from application state ("Write essay draft 1", "Ask Ms. Rivera…"), custom tasks with assignee/due date/time estimate, **task requests** (pending until accepted), "due today" checklist per user, missed-task sweep that flags the whole workspace (banner + feed + notification). |
| **Dashboard** | Stat tiles, 30-day completion-rate chart, 12-week activity heatmap, per-person streaks, upcoming school deadlines (separate from internal tasks), per-component progress bars, live activity feed. |
| **Realtime** | Presence (who's online and on which page/document), live sync of edits/comments/versions/tasks/feed without refresh, persistent workspace chat with @mentions. |
| **Cross-cutting** | Global search across all documents/comments/resources, @mention notifications, activity log auto-written by Postgres triggers (never manual), per-document status (draft / in review / final), export to .txt or print-to-PDF, soft-delete everywhere. |

## Design

- **Type:** [Fraunces](https://fonts.google.com/specimen/Fraunces) (display serif) +
  [Spline Sans](https://fonts.google.com/specimen/Spline+Sans) (UI), self-hosted via `next/font`.
- **Color:** deep pine `#175E54` + marigold `#D9A514` on warm paper `#F6F5F0`, ink `#20241F`,
  clay `#A33B34` for danger. A collegiate green-and-gold read without the generic
  cream/terracotta template look; counters use green → amber → red consistently for the
  non-blocking limit pattern. Chart colors (`#0E8A6B` etc.) were validated separately for
  colorblind separation and lightness.
- Restrained motion (Framer Motion: card entrances, drawer/modal transitions, drag feedback),
  `prefers-reduced-motion` respected globally, visible focus rings, responsive to mobile
  (collapsible nav drawer).

---

## Setup (one-time, ~10 minutes)

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, paste and run **`supabase/migrations/0001_init.sql`**
   (tables, RLS, triggers, storage buckets and policies).
3. Then run **`supabase/migrations/0002_seed_schools.sql`** (500-school directory).
4. *(Recommended for testing)* Authentication → Providers → Email → turn **off**
   "Confirm email" so accounts work instantly. Leave it on in production if you prefer —
   the signup flow handles both.
5. Project Settings → API: copy the **Project URL** and **anon public key**.

### 2. Local

```bash
cp .env.local.example .env.local   # then fill in the two Supabase values
npm install
npm run dev                        # http://localhost:3000
```

### 3. Deploy (Vercel free tier)

```bash
git remote add origin <your-github-repo> && git push -u origin main
```

Import the repo at [vercel.com/new](https://vercel.com/new), add the two env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), deploy. No other config.

### Try it collaboratively

Sign up, create a workspace, then Settings → invite a second email. Sign up with that email
in another browser — the invite auto-accepts and both sessions see each other's presence,
edits, comments, and chat live.

---

## School data: sourcing & refreshing

The directory is seeded from the **U.S. Department of Education College Scorecard API**
(`api.data.gov/ed/collegescorecard`) — the 500 largest currently-operating,
predominantly-bachelor's US institutions, sorted by undergraduate enrollment. Fields:
name, city, state, ownership, overall admission rate, undergrad size, website/domain.
No data is fabricated; schools missing a stat simply don't show that chip.

Logos come from Clearbit's free logo endpoint (`logo.clearbit.com/{domain}`) at render
time, with a monogram fallback when unavailable.

To refresh or extend (e.g. more pages, different filters):

```bash
SCORECARD_API_KEY=your-key node scripts/seed-schools.mjs   # DEMO_KEY works once
# regenerates supabase/seed/schools.json + supabase/migrations/0002_seed_schools.sql
```

Re-running the SQL upserts by `scorecard_id`, so it's safe to apply repeatedly. Schools can
also be inserted manually into `public.schools` for institutions outside the seed.

## Architecture notes

- **One document engine.** `documents` + `document_versions` + `comments` + `resources`
  power essay, every activity, brag sheets, extras, and every supplemental question —
  type-specific fields live in `documents.metadata` (jsonb).
- **Activity log is trigger-written.** Postgres `after insert/update` triggers on
  documents/versions/comments/tasks/resources/schools write `activity_log`; nothing in the
  frontend logs manually. Pure-content autosaves are filtered out so the feed stays meaningful.
- **RLS everywhere.** A `security definer` membership check (`is_member`) gates every
  workspace table; profiles are readable to authenticated users for attribution only.
- **Concurrency model (v1):** debounced last-write-wins on the working copy with remote
  updates applied only while you're not typing, plus per-page presence so collaborators can
  see who's where. Full CRDT merging (e.g. Yjs) is the natural v2 upgrade.
- **Missed tasks:** free tier has no cron, so `sweep_missed_tasks()` runs on dashboard load —
  it marks overdue committed tasks `missed` and notifies every member.
- **Nothing is lost:** versions are immutable snapshots; restores and imports auto-snapshot
  the current state first; deletes are soft (`deleted_at`) and restorable from Settings.
