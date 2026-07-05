-- Waypoint: collaborative college application workspace
-- Run this whole file in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New user',
  color text not null default '#175E54',
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces & membership
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  student_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'helper' check (role in ('student', 'helper')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'helper' check (role in ('student', 'helper')),
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now()
);

-- Security-definer membership check (avoids RLS recursion on workspace_members)
create or replace function public.is_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Documents: the generic writable unit (essay / activity / recommender /
-- extra / supplemental). metadata jsonb carries type-specific fields.
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (type in ('essay', 'activity', 'recommender', 'extra', 'supplemental')),
  title text not null default 'Untitled',
  current_content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'final')),
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index documents_workspace_idx on public.documents (workspace_id, type);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content jsonb not null,
  author_id uuid not null references public.profiles (id),
  version_label text,
  cover_image_url text,
  word_count int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index document_versions_doc_idx on public.document_versions (document_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  content text not null,
  anchor jsonb, -- { from, to, quote } character offsets for inline essay highlights
  resolved boolean not null default false,
  parent_id uuid references public.comments (id) on delete cascade,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index comments_doc_idx on public.comments (document_id);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  type text not null check (type in ('link', 'note', 'file')),
  title text not null default '',
  content text,
  url text,
  file_path text,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index resources_ws_idx on public.resources (workspace_id);

-- ---------------------------------------------------------------------------
-- Tasks & task requests
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  task_type text not null default 'custom',
  assigned_to uuid references public.profiles (id),
  assigned_by uuid references public.profiles (id),
  due_date date,
  estimated_minutes int,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'missed')),
  related_document_id uuid references public.documents (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_ws_idx on public.tasks (workspace_id, status);

create table public.task_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  title text not null,
  task_type text not null default 'custom',
  due_date date,
  estimated_minutes int,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chat, notifications, activity feed
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  content text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_ws_idx on public.messages (workspace_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null, -- mention | task_request | task_missed | invite | generic
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null,        -- created | updated | commented | versioned | ...
  target_type text not null,   -- document | task | comment | version | resource | member | school
  target_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_log_ws_idx on public.activity_log (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Schools (global directory) + per-workspace tracking
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  scorecard_id text unique,
  name text not null,
  city text,
  state text,
  ownership text, -- Public | Private nonprofit | Private for-profit
  admission_rate numeric,
  enrollment int,
  domain text,
  url text,
  created_at timestamptz not null default now()
);
create index schools_name_idx on public.schools using gin (to_tsvector('simple', name));

create table public.workspace_schools (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete')),
  rd_deadline date,
  ed_deadline date,
  ea_deadline date,
  notes text,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, school_id)
);

-- ---------------------------------------------------------------------------
-- Automatic activity logging (single generic trigger fn, per-table wiring)
-- ---------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  actor uuid := auth.uid();
  act text;
  ttype text := tg_argv[0];
  tid uuid;
  line text;
  actor_name text;
begin
  if tg_op = 'INSERT' then act := 'created'; else act := 'updated'; end if;

  if ttype = 'document' then
    ws := new.workspace_id; tid := new.id;
    if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then act := 'deleted'; end if;
    if tg_op = 'UPDATE' and new.deleted_at is null and old.deleted_at is not null then act := 'restored'; end if;
    line := act || ' ' || new.type || ' “' || new.title || '”';
  elsif ttype = 'version' then
    select d.workspace_id into ws from public.documents d where d.id = new.document_id;
    tid := new.id; act := 'versioned';
    line := 'saved a new version' || coalesce(' “' || new.version_label || '”', '');
  elsif ttype = 'comment' then
    select d.workspace_id into ws from public.documents d where d.id = new.document_id;
    tid := new.id;
    if tg_op = 'UPDATE' and new.resolved and not old.resolved then act := 'resolved'; line := 'resolved a comment';
    else act := 'commented'; line := 'commented: “' || left(new.content, 80) || '”'; end if;
  elsif ttype = 'task' then
    ws := new.workspace_id; tid := new.id;
    if tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then act := 'completed'; line := 'completed task “' || new.title || '”';
    elsif tg_op = 'UPDATE' and new.status = 'missed' and old.status <> 'missed' then act := 'missed'; line := 'missed task “' || new.title || '”';
    else line := act || ' task “' || new.title || '”'; end if;
  elsif ttype = 'resource' then
    ws := new.workspace_id; tid := new.id;
    line := 'added a ' || new.type || ' resource' || coalesce(' “' || nullif(new.title, '') || '”', '');
  elsif ttype = 'school' then
    ws := new.workspace_id; tid := new.id;
    line := act || ' a school on the list';
  else
    return new;
  end if;

  -- skip pure content autosaves (documents updated without title/status change)
  if ttype = 'document' and tg_op = 'UPDATE' and act = 'updated'
     and new.title = old.title and new.status = old.status
     and new.deleted_at is not distinct from old.deleted_at then
    return new;
  end if;

  select display_name into actor_name from public.profiles where id = actor;
  insert into public.activity_log (workspace_id, actor_id, action, target_type, target_id, summary)
  values (ws, actor, act, ttype, tid, coalesce(actor_name, 'Someone') || ' ' || line);
  return new;
end $$;

create trigger log_documents after insert or update on public.documents
  for each row execute function public.log_activity('document');
create trigger log_versions after insert on public.document_versions
  for each row execute function public.log_activity('version');
create trigger log_comments after insert or update on public.comments
  for each row execute function public.log_activity('comment');
create trigger log_tasks after insert or update on public.tasks
  for each row execute function public.log_activity('task');
create trigger log_resources after insert on public.resources
  for each row execute function public.log_activity('resource');
create trigger log_ws_schools after insert on public.workspace_schools
  for each row execute function public.log_activity('school');

-- @mention notifications for comments and chat messages
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  uid uuid;
  sender_name text;
begin
  if array_length(new.mentions, 1) is null then return new; end if;
  if tg_table_name = 'comments' then
    select d.workspace_id into ws from public.documents d where d.id = new.document_id;
  else
    ws := new.workspace_id;
  end if;
  select display_name into sender_name from public.profiles
    where id = coalesce(new.author_id, new.sender_id);
  foreach uid in array new.mentions loop
    if uid <> coalesce(new.author_id, new.sender_id) then
      insert into public.notifications (workspace_id, user_id, kind, body)
      values (ws, uid, 'mention', coalesce(sender_name, 'Someone') || ' mentioned you: “' || left(new.content, 100) || '”');
    end if;
  end loop;
  return new;
end $$;

create trigger mentions_comments after insert on public.comments
  for each row execute function public.notify_mentions();
create trigger mentions_messages after insert on public.messages
  for each row execute function public.notify_mentions();

-- Missed-task sweep: call from the app on dashboard load.
-- Marks overdue committed tasks as missed and notifies the whole workspace.
create or replace function public.sweep_missed_tasks(ws uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  t record;
  m record;
begin
  if not public.is_member(ws) then return 0; end if;
  for t in
    update public.tasks
    set status = 'missed'
    where workspace_id = ws and status in ('todo', 'in_progress')
      and due_date is not null and due_date < current_date
    returning id, title, assigned_to
  loop
    n := n + 1;
    for m in select user_id from public.workspace_members where workspace_id = ws loop
      insert into public.notifications (workspace_id, user_id, kind, body)
      values (ws, m.user_id, 'task_missed',
        coalesce((select display_name from public.profiles where id = t.assigned_to), 'Someone')
        || ' missed the task “' || t.title || '”');
    end loop;
  end loop;
  return n;
end $$;

-- Accept pending email invites for the current user (call after login)
create or replace function public.accept_my_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  inv record;
  my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  for inv in
    update public.workspace_invites set status = 'accepted'
    where lower(email) = lower(my_email) and status = 'pending'
    returning workspace_id, role
  loop
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Create a workspace + owner membership atomically
create or replace function public.create_workspace(ws_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (name, student_id) values (ws_name, auth.uid()) returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, auth.uid(), 'student');
  return ws_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.comments enable row level security;
alter table public.resources enable row level security;
alter table public.tasks enable row level security;
alter table public.task_requests enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.schools enable row level security;
alter table public.workspace_schools enable row level security;

-- profiles: readable by any signed-in user (needed for attribution), self-editable
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "workspaces member read" on public.workspaces for select to authenticated using (public.is_member(id));
create policy "workspaces owner update" on public.workspaces for update to authenticated using (student_id = auth.uid());

create policy "members read" on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy "members owner manage" on public.workspace_members for delete to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.student_id = auth.uid()) or user_id = auth.uid());

create policy "invites member read" on public.workspace_invites for select to authenticated using (public.is_member(workspace_id));
create policy "invites member create" on public.workspace_invites for insert to authenticated with check (public.is_member(workspace_id) and invited_by = auth.uid());
create policy "invites member delete" on public.workspace_invites for delete to authenticated using (public.is_member(workspace_id));

create policy "documents member all" on public.documents for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create policy "versions member all" on public.document_versions for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.workspace_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.workspace_id)));

create policy "comments member all" on public.comments for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.workspace_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.workspace_id)));

create policy "resources member all" on public.resources for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create policy "tasks member all" on public.tasks for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create policy "task_requests member all" on public.task_requests for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create policy "messages member read" on public.messages for select to authenticated using (public.is_member(workspace_id));
create policy "messages member send" on public.messages for insert to authenticated
  with check (public.is_member(workspace_id) and sender_id = auth.uid());

create policy "notifications self read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications self update" on public.notifications for update to authenticated using (user_id = auth.uid());

create policy "activity member read" on public.activity_log for select to authenticated using (public.is_member(workspace_id));

create policy "schools readable" on public.schools for select to authenticated using (true);
create policy "schools insert" on public.schools for insert to authenticated with check (true);

create policy "ws_schools member all" on public.workspace_schools for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.documents, public.document_versions, public.comments, public.tasks,
  public.task_requests, public.messages, public.notifications, public.activity_log,
  public.workspace_schools, public.resources;

-- ---------------------------------------------------------------------------
-- Storage buckets (covers for version cards, files for attachments)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict do nothing;

create policy "covers read" on storage.objects for select to authenticated using (bucket_id = 'covers');
create policy "covers write" on storage.objects for insert to authenticated with check (bucket_id = 'covers');
create policy "files member read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "files member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
