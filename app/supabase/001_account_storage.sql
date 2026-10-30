-- Team Progress: execute in the Supabase SQL Editor.
-- Stores training and habits together, one private snapshot per account.
begin;

create table public.progress_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.progress_states enable row level security;
revoke all on public.progress_states from public, anon, authenticated;
grant select on public.progress_states to authenticated;
create policy read_own_progress on public.progress_states
  for select to authenticated using (user_id = (select auth.uid()));

-- Writes go through this function. The authenticated session determines the
-- account; callers cannot submit another person's user ID. The revision check
-- prevents one device silently replacing a newer snapshot from another device.
create function public.save_progress(expected_revision bigint, new_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  saved_revision bigint;
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0
     or new_payload is null or jsonb_typeof(new_payload) <> 'object'
     or octet_length(new_payload::text) > 2000000
     or (new_payload->>'version') is distinct from '2'
     or jsonb_typeof(new_payload->'sessions') is distinct from 'array'
     or jsonb_typeof(new_payload->'plans') is distinct from 'array'
     or jsonb_typeof(new_payload->'habits') is distinct from 'array'
     or jsonb_typeof(new_payload->'habitEntries') is distinct from 'array' then
    raise exception 'Invalid progress data' using errcode = '22023';
  end if;
  -- Running workouts remain on the device, matching the current app.
  new_payload := jsonb_set(new_payload, '{active}', 'null'::jsonb, true);
  if expected_revision = 0 then
    insert into public.progress_states (user_id, revision, payload)
    values (account_id, 1, new_payload)
    on conflict (user_id) do nothing
    returning revision into saved_revision;
  else
    update public.progress_states
      set payload = new_payload, revision = revision + 1, updated_at = now()
      where user_id = account_id and revision = expected_revision
      returning revision into saved_revision;
  end if;
  if saved_revision is null then
    raise exception 'Progress changed on another device; reload and merge'
      using errcode = '40001';
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_progress(bigint, jsonb) from public, anon;
grant execute on function public.save_progress(bigint, jsonb) to authenticated;

commit;
