-- Comment suggestions: a comment anchored to a text range can carry a proposed
-- replacement. Any workspace member can accept (applies the edit) or dismiss it.
alter table public.comments
  add column if not exists suggestion text,
  add column if not exists suggestion_status text
    check (suggestion_status in ('pending', 'accepted', 'rejected'));
