-- Run once in the Supabase SQL Editor to enable self-service account deletion.
begin;
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from auth.users where id = caller;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
commit;
