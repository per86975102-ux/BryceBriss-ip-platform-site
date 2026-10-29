-- =============================================================================
-- Bryce Briss IP Platform · v2 hardening migration (for EXISTING databases)
-- =============================================================================
-- LEGACY MIGRATION: This file does not match the V3 frontend data contract. Do not execute for V3.
-- Use only after a deliberate migration review.
-- Usage: This legacy migration was intended for databases using the previous schema.
-- The migration is designed to be repeatable and does not recreate tables.
-- Review the diagnostic queries at the end before any migration.
-- Rollback of grants, triggers, foreign keys, and policies requires manual restoration.
-- See SUPABASE-SETUP.md for legacy rollback notes.
-- =============================================================================

-- 1) is_admin() SECURITY DEFINER function -----------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on public.is_admin() to anon, authenticated;

-- 2) Profile column privileges: revoke role access and grant minimum required permissions.
-- Table-level REVOKE does not remove existing column-level grants; revoke role separately.
revoke all on public.profiles from anon, authenticated;
revoke select (role) on public.profiles from anon, authenticated;
revoke update (role) on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 3) Role-escalation protection trigger -------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' then
    raise exception 'Clients cannot change role; promote administrators through a trusted database session.'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

revoke all on function public.handle_new_user() from anon, authenticated;

-- 4) comments.user_id -> profiles(id) foreign key for author profile queries -----------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'comments_user_id_profiles_fkey'
      and n.nspname = 'public' and t.relname = 'comments'
  ) then
    alter table public.comments
      add constraint comments_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- 5) Automatically refresh works.updated_at -------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_works_touch on public.works;
create trigger trg_works_touch before update on public.works
  for each row execute function public.touch_updated_at();

-- 6) Rebuild RLS policies using is_admin() and published-work checks. -------------------------
-- profiles: users read their own profile; comment authors may be publicly discoverable.
drop policy if exists "profiles readable by authenticated users" on public.profiles;
drop policy if exists "profiles public read id+display_name" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "comment authors public" on public.profiles;
create policy "comment authors public" on public.profiles
  for select to anon, authenticated using (
    exists (select 1 from public.comments c
            where c.user_id = profiles.id and c.is_hidden = false)
  );

drop policy if exists "users update own display name" on public.profiles;
create policy "users update own display name" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- works
drop policy if exists "published works are public" on public.works;
create policy "published works are public" on public.works
  for select using (status = 'published' or public.is_admin());

drop policy if exists "admins insert works" on public.works;
create policy "admins insert works" on public.works
  for insert to authenticated with check (
    public.is_admin() and created_by = auth.uid()
  );

drop policy if exists "admins update works" on public.works;
create policy "admins update works" on public.works
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete works" on public.works;
create policy "admins delete works" on public.works
  for delete to authenticated using (public.is_admin());

-- comments
drop policy if exists "public can read visible comments" on public.comments;
create policy "public can read visible comments" on public.comments
  for select using (is_hidden = false);

drop policy if exists "authenticated users add own comments" on public.comments;
create policy "authenticated users add own comments" on public.comments
  for insert to authenticated with check (
    auth.uid() = user_id
    and (work_id is null or exists (
      select 1 from public.works w where w.id = comments.work_id and w.status = 'published'
    ))
  );

drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "admins moderate comments" on public.comments;
create policy "admins moderate comments" on public.comments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- favorites
drop policy if exists "favorites visible to owner" on public.favorites;
create policy "favorites visible to owner" on public.favorites
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users add own favorites" on public.favorites;
create policy "users add own favorites" on public.favorites
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.works w where w.id = favorites.work_id and w.status = 'published')
  );

drop policy if exists "users remove own favorites" on public.favorites;
create policy "users remove own favorites" on public.favorites
  for delete to authenticated using (auth.uid() = user_id);

-- 7) Indexes ---------------------------------------------------------------------
create index if not exists idx_works_status on public.works(status);
create index if not exists idx_comments_work on public.comments(work_id);
create index if not exists idx_comments_user on public.comments(user_id);
create index if not exists idx_favorites_work on public.favorites(work_id);

-- =============================================================================
-- Pre-migration diagnostics: review query results before running this legacy migration.
--
--   -- (a) Find comments without a matching profile; these prevent foreign-key creation.
--   select c.id, c.user_id from public.comments c
--   left join public.profiles p on p.id = c.user_id where p.id is null;
--
--   -- (b) Verify authenticated users can SELECT only id and display_name
--   --     and UPDATE display_name; anon/authenticated must have no role privileges.
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema='public' and table_name='profiles'
--   order by grantee, column_name, privilege_type;
--
--   -- (c) Confirm no role privileges are granted to anon/authenticated.
--   select grantee, privilege_type
--   from information_schema.column_privileges
--   where table_schema='public' and table_name='profiles'
--     and column_name='role' and grantee in ('anon','authenticated');
--   -- Query (c) should return zero rows.
--
--   -- (d) Inspect the profile RLS policy list.
--   select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='profiles';
-- =============================================================================
