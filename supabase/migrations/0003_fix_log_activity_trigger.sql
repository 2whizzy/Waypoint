-- log_activity() had a check after the ttype branch chain that unconditionally
-- referenced new.title / new.status / new.deleted_at. Those columns only exist
-- on public.documents, so the trigger threw "record new has no field ..." for
-- every other wired table (workspace_schools, document_versions, comments,
-- resources) — e.g. adding a school to a workspace's list, leaving a comment,
-- saving a version, or adding a resource all failed. Moving the check inside
-- the document branch means it's only ever evaluated for document rows.
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
    -- skip pure content autosaves (documents updated without title/status change)
    if tg_op = 'UPDATE' and act = 'updated' and new.title = old.title and new.status = old.status
       and new.deleted_at is not distinct from old.deleted_at then
      return new;
    end if;
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

  select display_name into actor_name from public.profiles where id = actor;
  insert into public.activity_log (workspace_id, actor_id, action, target_type, target_id, summary)
  values (ws, actor, act, ttype, tid, coalesce(actor_name, 'Someone') || ' ' || line);
  return new;
end $$;
