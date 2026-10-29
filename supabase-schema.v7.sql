-- =============================================================================
-- Bryce Briss IP Platform V7 — guarded fresh-schema setup
-- =============================================================================
-- STATUS: NOT EXECUTED. Prepared for the user-approved target project only after
-- review of this exact SQL and separate execution approval.
-- Target: empty public schema in BryceBriss_IP_test (project ref checked 2026-10-28).
-- This is NOT a generic upgrade script for a database already running V3/V2.
-- It aborts before DDL when known collisions or application auth.users triggers exist.
-- Run only after a backup/export and checking the V7 preflight checklist.
-- No user, admin account, email, password, or secret key is created by this script.
-- =============================================================================

begin;

-- Fail closed before creating anything if the target has application objects that
-- could be overwritten or if Storage/Auth prerequisites are not as expected.
do $$
declare
  item text;
begin
  if to_regclass('auth.users') is null then
    raise exception 'Preflight failed: auth.users is unavailable; stop and inspect the project.';
  end if;
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Preflight failed: Supabase Storage is unavailable; stop and inspect the project.';
  end if;
  if not has_schema_privilege('anon','storage','USAGE')
     or not has_schema_privilege('authenticated','storage','USAGE')
     or not has_table_privilege('anon','storage.objects','SELECT')
     or not has_table_privilege('authenticated','storage.objects','SELECT')
     or not has_table_privilege('authenticated','storage.objects','INSERT')
     or not has_table_privilege('authenticated','storage.objects','UPDATE')
     or not has_table_privilege('authenticated','storage.objects','DELETE') then
    raise exception 'Preflight failed: expected Supabase Storage schema/table grants are missing; inspect them rather than broadening grants in this migration.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Preflight failed: storage.objects RLS is not enabled; stop and inspect the project.';
  end if;

  foreach item in array array[
    'profiles','series','works','work_chapters','comments','favorites',
    'site_content','contact_channels','ip_entries','media_assets'
  ] loop
    if to_regclass('public.' || item) is not null then
      raise exception 'Preflight failed: public.% already exists. Do not run this fresh-schema script over existing data.', item;
    end if;
  end loop;

  if to_regprocedure('public.handle_new_user()') is not null
     or to_regprocedure('public.is_admin()') is not null
     or to_regprocedure('public.touch_updated_at()') is not null
     or to_regprocedure('public.guard_profile_role()') is not null
     or to_regprocedure('public.guard_public_cover()') is not null
     or to_regprocedure('public.guard_published_chapter_media()') is not null then
    raise exception 'Preflight failed: a V3/V7-compatible public function already exists; use a reviewed incremental migration instead.';
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
  ) then
    raise exception 'Preflight failed: auth.users already has an application trigger. Inspect it before installing a second profile trigger.';
  end if;

  if exists (
    select 1 from storage.buckets
    where id in ('bryce-briss-public-media','bryce-briss-private-media')
  ) then
    raise exception 'Preflight failed: a V7 media bucket already exists; do not replace its settings or contents.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  ) then
    raise exception 'Preflight failed: storage.objects already has policies. Review the full policy set before installing V7 policies.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Core records inherited from V3
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  role text not null default 'reader' check (role in ('reader','admin')),
  created_at timestamptz not null default now()
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique check (char_length(slug) between 1 and 180),
  description text check (description is null or char_length(description) <= 3000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (char_length(slug) between 1 and 180),
  summary text check (summary is null or char_length(summary) <= 3000),
  category text not null default 'fiction' check (category in ('fiction','essay','music','comic','animation','world')),
  language text not null default 'zh' check (language in ('zh','en','fr','multi')),
  series_id uuid references public.series(id) on delete set null,
  cover_path text check (
    cover_path is null
    or cover_path ~* '^https://'
    or (cover_path ~ '^(public|private):[A-Za-z0-9._/-]+$' and cover_path !~ '(^|/)\.\.(/|$)')
  ),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  chapter_number integer not null check (chapter_number >= 1),
  title text not null check (char_length(title) between 1 and 200),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, chapter_number)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  constraint comments_user_id_profiles_fkey foreign key (user_id) references public.profiles(id) on delete cascade
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

-- -----------------------------------------------------------------------------
-- V7 editorial CMS: page copy, public contacts, IP entries and media metadata
-- -----------------------------------------------------------------------------
create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null check (content_key ~ '^[A-Za-z0-9_.-]{1,180}$'),
  locale text not null check (locale in ('zh','en','fr')),
  body_text text not null default '' check (char_length(body_text) <= 8000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_key, locale)
);

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null check (channel_type in ('email','business','social','other')),
  label text not null check (char_length(label) between 1 and 120),
  value text not null check (char_length(value) between 1 and 500),
  href text check (href is null or (char_length(href) <= 1000 and href ~* '^(https://|mailto:|tel:)')),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ip_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('character','world','gallery','journal')),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (char_length(slug) between 1 and 180),
  summary text check (summary is null or char_length(summary) <= 3000),
  body_text text not null default '' check (char_length(body_text) <= 50000),
  locale text not null check (locale in ('zh','en','fr')),
  cover_path text check (
    cover_path is null
    or cover_path ~* '^https://'
    or (cover_path ~ '^(public|private):[A-Za-z0-9._/-]+$' and cover_path !~ '(^|/)\.\.(/|$)')
  ),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0 check (sort_order between 0 and 99999),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null check (bucket_id in ('bryce-briss-public-media','bryce-briss-private-media')),
  object_path text not null check (object_path ~ '^[A-Za-z0-9._/-]+$' and object_path !~ '(^|/)\.\.(/|$)'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  visibility text not null check (visibility in ('public','private')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  check ((visibility = 'public' and bucket_id = 'bryce-briss-public-media') or (visibility = 'private' and bucket_id = 'bryce-briss-private-media'))
);

-- -----------------------------------------------------------------------------
-- Auth and integrity functions. No role can be granted through client form fields.
-- -----------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', 'Reader'), 80), 'reader');
  return new;
end;
$$;

create trigger bryce_v7_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.guard_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' then
    raise exception 'Clients cannot change profile role; use a trusted administrator SQL session.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.guard_public_cover()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.cover_path like 'private:%' then
    raise exception 'A private media object cannot be attached to a published record.' using errcode = '23514';
  end if;
  if new.status = 'published' and new.cover_path ~* '^https://[^/?#]+/storage/v1/object/sign/' then
    raise exception 'A signed private Storage URL cannot be attached to a published record.' using errcode = '23514';
  end if;
  if new.status = 'published' and new.cover_path ~ '[?#]' then
    raise exception 'Published media URLs cannot include query strings or fragments.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.guard_published_chapter_media()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.body::text ~* '"(src|href)"[[:space:]]*:[[:space:]]*"https://[^" ]*[?#]' then
    raise exception 'Published chapter content cannot include signed/query-string/fragment URLs.' using errcode = '23514';
  end if;
  if new.status = 'published' and new.body::text ~* 'supabase\.co/storage/v1/object/sign/' then
    raise exception 'A signed Supabase Storage URL cannot be published in chapter content.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_role before update on public.profiles
for each row execute function public.guard_profile_role();
create trigger trg_works_touch before update on public.works
for each row execute function public.touch_updated_at();
create trigger trg_series_touch before update on public.series
for each row execute function public.touch_updated_at();
create trigger trg_chapters_touch before update on public.work_chapters
for each row execute function public.touch_updated_at();
create trigger trg_site_content_touch before update on public.site_content
for each row execute function public.touch_updated_at();
create trigger trg_contact_channels_touch before update on public.contact_channels
for each row execute function public.touch_updated_at();
create trigger trg_ip_entries_touch before update on public.ip_entries
for each row execute function public.touch_updated_at();
create trigger trg_works_public_cover before insert or update on public.works
for each row execute function public.guard_public_cover();
create trigger trg_entries_public_cover before insert or update on public.ip_entries
for each row execute function public.guard_public_cover();
create trigger trg_chapters_public_media before insert or update on public.work_chapters
for each row execute function public.guard_published_chapter_media();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.guard_profile_role() from public, anon, authenticated;
revoke all on function public.guard_public_cover() from public, anon, authenticated;
revoke all on function public.guard_published_chapter_media() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS: all content tables are protected; anon reads only explicitly published rows.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.series enable row level security;
alter table public.works enable row level security;
alter table public.work_chapters enable row level security;
alter table public.comments enable row level security;
alter table public.favorites enable row level security;
alter table public.site_content enable row level security;
alter table public.contact_channels enable row level security;
alter table public.ip_entries enable row level security;
alter table public.media_assets enable row level security;

create policy "bryce_v7_profile_self_read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "bryce_v7_admin_profiles_read" on public.profiles for select to authenticated using (public.is_admin());
create policy "bryce_v7_comment_author_public" on public.profiles for select to anon, authenticated using (
  exists (select 1 from public.comments c where c.user_id = profiles.id and c.status = 'visible'
    and exists (select 1 from public.works w where w.id = c.work_id and w.status = 'published'
      and (w.series_id is null or exists (select 1 from public.series s where s.id = w.series_id and s.status = 'published'))))
);
create policy "bryce_v7_profile_self_update" on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

create policy "bryce_v7_series_read" on public.series for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "bryce_v7_series_insert" on public.series for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_series_update" on public.series for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "bryce_v7_works_read" on public.works for select to anon, authenticated using (
  (status = 'published' and (series_id is null or exists (select 1 from public.series s where s.id = works.series_id and s.status = 'published')))
  or public.is_admin()
);
create policy "bryce_v7_works_insert" on public.works for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_works_update" on public.works for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "bryce_v7_chapters_read" on public.work_chapters for select to anon, authenticated using (
  public.is_admin() or (status = 'published' and exists (
    select 1 from public.works w where w.id = work_chapters.work_id and w.status = 'published'
      and (w.series_id is null or exists (select 1 from public.series s where s.id = w.series_id and s.status = 'published'))))
);
create policy "bryce_v7_chapters_insert" on public.work_chapters for insert to authenticated with check (public.is_admin());
create policy "bryce_v7_chapters_update" on public.work_chapters for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bryce_v7_chapters_delete" on public.work_chapters for delete to authenticated using (public.is_admin());

create policy "bryce_v7_comments_read" on public.comments for select to anon, authenticated using (
  public.is_admin() or (status = 'visible' and exists (
    select 1 from public.works w where w.id = comments.work_id and w.status = 'published'
      and (w.series_id is null or exists (select 1 from public.series s where s.id = w.series_id and s.status = 'published'))))
);
create policy "bryce_v7_comments_insert" on public.comments for insert to authenticated with check (
  auth.uid() = user_id and status = 'visible' and exists (
    select 1 from public.works w where w.id = comments.work_id and w.status = 'published'
      and (w.series_id is null or exists (select 1 from public.series s where s.id = w.series_id and s.status = 'published')))
);
create policy "bryce_v7_comments_moderate" on public.comments for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "bryce_v7_favorites_owner_read" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "bryce_v7_favorites_owner_insert" on public.favorites for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.works w where w.id = favorites.work_id and w.status = 'published'
    and (w.series_id is null or exists (select 1 from public.series s where s.id = w.series_id and s.status = 'published')))
);
create policy "bryce_v7_favorites_owner_delete" on public.favorites for delete to authenticated using (auth.uid() = user_id);

create policy "bryce_v7_site_content_public_read" on public.site_content for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "bryce_v7_site_content_admin_insert" on public.site_content for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_site_content_admin_update" on public.site_content for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bryce_v7_site_content_admin_delete" on public.site_content for delete to authenticated using (public.is_admin());

create policy "bryce_v7_contacts_public_read" on public.contact_channels for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "bryce_v7_contacts_admin_insert" on public.contact_channels for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_contacts_admin_update" on public.contact_channels for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bryce_v7_contacts_admin_delete" on public.contact_channels for delete to authenticated using (public.is_admin());

create policy "bryce_v7_entries_public_read" on public.ip_entries for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "bryce_v7_entries_admin_insert" on public.ip_entries for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_entries_admin_update" on public.ip_entries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bryce_v7_entries_admin_delete" on public.ip_entries for delete to authenticated using (public.is_admin());

create policy "bryce_v7_media_metadata_read" on public.media_assets for select to anon, authenticated using (visibility = 'public' or public.is_admin());
create policy "bryce_v7_media_metadata_insert" on public.media_assets for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "bryce_v7_media_metadata_update" on public.media_assets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bryce_v7_media_metadata_delete" on public.media_assets for delete to authenticated using (public.is_admin());

-- Column-level grants preserve least privilege even when a row policy allows the row.
revoke all on public.profiles, public.series, public.works, public.work_chapters,
  public.comments, public.favorites, public.site_content, public.contact_channels,
  public.ip_entries, public.media_assets from anon, authenticated;

grant select (id, display_name) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.series, public.works, public.work_chapters, public.comments to anon, authenticated;
grant insert, update on public.series to authenticated;
grant insert, update on public.works to authenticated;
grant insert, update, delete on public.work_chapters to authenticated;
grant insert (user_id, work_id, body) on public.comments to authenticated;
grant update (status) on public.comments to authenticated;
grant select, insert, delete on public.favorites to authenticated;

grant select on public.site_content, public.contact_channels, public.ip_entries, public.media_assets to anon, authenticated;
grant insert, update, delete on public.site_content, public.contact_channels, public.ip_entries, public.media_assets to authenticated;
grant insert, update on public.media_assets to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: public assets are explicitly publishable; private drafts require admin.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bryce-briss-public-media','Bryce Briss Public Media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('bryce-briss-private-media','Bryce Briss Private Media',false,10485760,array['image/jpeg','image/png','image/webp','image/avif']);

create policy "bryce_v7_public_media_read" on storage.objects for select to anon, authenticated
using (bucket_id = 'bryce-briss-public-media');
create policy "bryce_v7_public_media_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'bryce-briss-public-media' and public.is_admin());
create policy "bryce_v7_public_media_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'bryce-briss-public-media' and public.is_admin())
with check (bucket_id = 'bryce-briss-public-media' and public.is_admin());
create policy "bryce_v7_public_media_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'bryce-briss-public-media' and public.is_admin());
create policy "bryce_v7_private_media_admin_read" on storage.objects for select to authenticated
using (bucket_id = 'bryce-briss-private-media' and public.is_admin());
create policy "bryce_v7_private_media_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'bryce-briss-private-media' and public.is_admin());
create policy "bryce_v7_private_media_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'bryce-briss-private-media' and public.is_admin())
with check (bucket_id = 'bryce-briss-private-media' and public.is_admin());
create policy "bryce_v7_private_media_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'bryce-briss-private-media' and public.is_admin());
-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index idx_works_status on public.works(status);
create index idx_works_series on public.works(series_id);
create index idx_works_published_at on public.works(published_at desc);
create index idx_chapters_work on public.work_chapters(work_id);
create index idx_chapters_status on public.work_chapters(status);
create index idx_comments_work on public.comments(work_id);
create index idx_comments_user on public.comments(user_id);
create index idx_comments_status on public.comments(status);
create index idx_favorites_work on public.favorites(work_id);
create index idx_site_content_public on public.site_content(locale,status,content_key);
create index idx_contacts_public on public.contact_channels(status,display_order);
create index idx_ip_entries_public on public.ip_entries(entry_type,locale,status,sort_order);
create index idx_media_assets_created_by on public.media_assets(created_by,created_at desc);

comment on table public.site_content is 'V7 localized plain-text page copy; only published rows are public.';
comment on table public.ip_entries is 'V7 dynamic character/world/gallery/journal entries; public reads require published status.';
comment on table public.media_assets is 'V7 Storage metadata; private objects are not exposed to anon.';

-- This transaction is intentionally left to the operator. Do not remove the
-- preflight guards or use this as a replacement for a reviewed V3 data migration.
commit;
