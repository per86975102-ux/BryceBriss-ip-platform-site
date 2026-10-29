-- =============================================================================
-- Bryce Briss IP Platform · Fresh-install schema (secure by default)
-- =============================================================================
-- LEGACY SCHEMA: This file does not match the V3 frontend data contract. Do not execute for V3.
-- Use only after a deliberate migration review.
-- Usage: Execute only in a new Supabase project.
-- Existing installations require a separately reviewed migration plan.
-- Do not use this legacy schema for the V3 frontend.
-- The schema contract differs from the V3 frontend.
-- Design principles:
--   * Readers cannot change the role column.
--   * Public profile access exposes only id and display_name, never role.
--   * Admin checks use a SECURITY DEFINER function instead of exposing role.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Table definitions
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'reader' check (role in ('reader','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  summary text not null check (char_length(summary) between 1 and 1200),
  category text not null default 'fiction',
  language text not null default 'zh',
  series text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, work_id)
);

-- Link comment authors to profiles for PostgREST relationship queries.
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

-- ---------------------------------------------------------------------------
-- New-user trigger: force the reader role and read display_name from signup metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Reader'), 'reader')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin(): allow RLS checks without exposing the role column to clients.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Automatically refresh updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_works_touch on public.works;
create trigger trg_works_touch before update on public.works
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Fallback trigger to prevent clients from changing role.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Column-level permissions: expose id and display_name only; deny client access to role.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke all on function public.handle_new_user() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable row-level security.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.comments enable row level security;
alter table public.favorites enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security policies
-- ---------------------------------------------------------------------------
-- profiles: users can read their own profile; comment authors may be publicly discoverable.
-- This supports comment attribution without exposing the full user directory.
drop policy if exists "profiles public read id+display_name" on public.profiles;
drop policy if exists "profiles readable by authenticated users" on public.profiles;
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

-- works: public reads published works; admins manage records.
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

-- comments: public reads visible comments; authenticated users insert; authors delete; admins moderate.
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

-- favorites: users manage their own favorites for published works.
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

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_works_status on public.works(status);
create index if not exists idx_comments_work on public.comments(work_id);
create index if not exists idx_comments_user on public.comments(user_id);
create index if not exists idx_favorites_work on public.favorites(work_id);

-- =============================================================================
-- After installation, promote the intended administrator using a trusted SQL session:
--   UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
-- =============================================================================
