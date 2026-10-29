-- =============================================================================
-- Bryce Briss IP Platform · V3 Fresh-Install Schema
-- =============================================================================
-- 用途：在一个全新的 Supabase 项目里执行，匹配当前 V3 前端
--       (platform.js / read.js / community.js / admin.js) 的数据契约。
-- 不要在已经跑过 supabase-schema.sql / .v2.sql 的旧库上直接重复执行本文件。
-- 已有库需要一份单独的迁移脚本（本文件不提供）。
--
-- 前端实际用到的表与字段：
--   works(id,title,slug,summary,category,language,series_id,cover_path,
--         status,draft|published|archived,published_at,created_by,
--         created_at,updated_at)
--   series(id,title,slug,description,status,draft|published|archived,
--          published_at,created_at)
--   work_chapters(id,work_id,chapter_number,title,body jsonb,
--                 status,draft|published,published_at,updated_at)
--   comments(id,work_id,user_id,body,status,visible|hidden,created_at)
--   favorites(user_id,work_id,created_at)
--   profiles(id,display_name,role,reader|admin,created_at)
--
-- 安全原则：
--   * 读者不能改 role；管理员通过受信任 SQL 授予。
--   * 公开列只暴露 id+display_name，不暴露 role。
--   * 所有动态表都开 RLS；新表（series/work_chapters）也配策略。
--   * 章节/系列草稿任何人都读不到。
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 表结构
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'reader' check (role in ('reader','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique check (char_length(slug) between 1 and 180),
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (char_length(slug) between 1 and 180),
  summary text check (char_length(summary) between 0 and 3000),
  category text not null default 'fiction'
    check (category in ('fiction','essay','music','comic','animation','world')),
  language text not null default 'zh'
    check (language in ('zh','en','fr','multi')),
  series_id uuid references public.series(id) on delete set null,
  cover_path text check (cover_path is null or cover_path ~* '^https://'),
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_chapters (
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

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);

-- 评论作者关联到 profiles，便于前端联表取 display_name
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

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

-- ---------------------------------------------------------------------------
-- 新用户触发器：默认 reader，display_name 从注册元数据读
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'display_name', 'Reader'),
          'reader')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin()：RLS 里判管理员，不暴露 role 列
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at 自动刷新
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_works_touch on public.works;
create trigger trg_works_touch before update on public.works
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_series_touch on public.series;
create trigger trg_series_touch before update on public.series
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_chapters_touch on public.work_chapters;
create trigger trg_chapters_touch before update on public.work_chapters
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 兜底触发器：客户端不能改 role
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' then
    raise exception 'Clients cannot change role; promote admins via a trusted SQL session.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role before update on public.profiles
for each row execute function public.guard_profile_role();

revoke all on function public.handle_new_user() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 列级权限：profiles 只暴露 id+display_name；role 列显式回收
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
revoke select (role) on public.profiles from anon, authenticated;
revoke update (role) on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 打开 RLS
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.series         enable row level security;
alter table public.works         enable row level security;
alter table public.work_chapters enable row level security;
alter table public.comments       enable row level security;
alter table public.favorites     enable row level security;

-- ---------------------------------------------------------------------------
-- RLS 策略
-- ---------------------------------------------------------------------------

-- profiles：本人可读自己；发过 visible 评论的人昵称才公开（不允许批量拉用户表）
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "comment authors public" on public.profiles;
create policy "comment authors public" on public.profiles
  for select to anon, authenticated using (
    exists (select 1 from public.comments c
            where c.user_id = profiles.id and c.status = 'visible')
  );

drop policy if exists "users update own display name" on public.profiles;
create policy "users update own display name" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- series：已发布可读；管理员写
drop policy if exists "series public read" on public.series;
create policy "series public read" on public.series
  for select using (status = 'published' or public.is_admin());

drop policy if exists "series admin insert" on public.series;
create policy "series admin insert" on public.series
  for insert to authenticated with check (public.is_admin());

drop policy if exists "series admin update" on public.series;
create policy "series admin update" on public.series
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 系列也采用归档而非常规物理删除，避免作品失去系列状态约束。

-- works：已发布可读（所属系列也必须已发布或为空）；管理员写
drop policy if exists "works public read" on public.works;
create policy "works public read" on public.works
  for select using (
    (status = 'published'
      and (series_id is null
           or exists (select 1 from public.series s
                      where s.id = works.series_id and s.status = 'published')))
    or public.is_admin()
  );

drop policy if exists "works admin insert" on public.works;
create policy "works admin insert" on public.works
  for insert to authenticated with check (
    public.is_admin() and created_by = auth.uid()
  );

drop policy if exists "works admin update" on public.works;
create policy "works admin update" on public.works
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 作品只能归档，不通过常规客户端策略物理删除。
-- 物理删除权限也会显式撤销，避免误删作品级评论历史。

-- work_chapters：所属作品已发布时，已发布章节才可公开读；管理员写
drop policy if exists "chapters public read" on public.work_chapters;
create policy "chapters public read" on public.work_chapters
  for select using (
    public.is_admin()
    or (status = 'published'
      and exists (select 1 from public.works w
                  where w.id = work_chapters.work_id
                    and w.status = 'published'
                    and (w.series_id is null or exists (
                      select 1 from public.series s
                      where s.id = w.series_id and s.status = 'published'
                    ))))
  );

drop policy if exists "chapters admin insert" on public.work_chapters;
create policy "chapters admin insert" on public.work_chapters
  for insert to authenticated with check (public.is_admin());

drop policy if exists "chapters admin update" on public.work_chapters;
create policy "chapters admin update" on public.work_chapters
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chapters admin delete" on public.work_chapters;
create policy "chapters admin delete" on public.work_chapters
  for delete to authenticated using (public.is_admin());

-- comments：直接发布；公开评论必须属于当前公开作品与公开系列。
-- 管理员可读取归档作品评论历史并进行隐藏/恢复。
drop policy if exists "comments public read" on public.comments;
create policy "comments public read" on public.comments
  for select using (
    public.is_admin()
    or (status = 'visible' and exists (
      select 1 from public.works w
      where w.id = comments.work_id and w.status = 'published'
        and (w.series_id is null or exists (
          select 1 from public.series s
          where s.id = w.series_id and s.status = 'published'
        ))
    ))
  );

drop policy if exists "comments authenticated insert" on public.comments;
create policy "comments authenticated insert" on public.comments
  for insert to authenticated with check (
    auth.uid() = user_id and status = 'visible'
    and exists (select 1 from public.works w
                where w.id = comments.work_id and w.status = 'published'
                  and (w.series_id is null or exists (
                    select 1 from public.series s
                    where s.id = w.series_id and s.status = 'published'
                  )))
  );

-- 评论历史不提供普通用户物理删除入口；作者或管理员可通过管理员审核流程隐藏评论。
drop policy if exists "comments admin moderate" on public.comments;
create policy "comments admin moderate" on public.comments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- favorites：只看得到/改得动自己的
drop policy if exists "favorites owner read" on public.favorites;
create policy "favorites owner read" on public.favorites
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "favorites owner insert" on public.favorites;
create policy "favorites owner insert" on public.favorites
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.works w
                where w.id = favorites.work_id and w.status = 'published'
                  and (w.series_id is null or exists (
                    select 1 from public.series s
                    where s.id = w.series_id and s.status = 'published'
                  )))
  );

drop policy if exists "favorites owner delete" on public.favorites;
create policy "favorites owner delete" on public.favorites
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 显式表权限：RLS 负责行级边界，GRANT/REVOKE 负责表级入口
-- ---------------------------------------------------------------------------
revoke all on public.series, public.works, public.work_chapters,
  public.comments, public.favorites from anon, authenticated;
grant select on public.series, public.works, public.work_chapters, public.comments to anon, authenticated;
grant select, insert, update on public.series to authenticated;
grant select, insert, update, delete on public.work_chapters to authenticated;
grant select, insert, update on public.works to authenticated;
grant select on public.comments to authenticated;
grant insert (user_id, work_id, body) on public.comments to authenticated;
grant update (status) on public.comments to authenticated;
grant select, insert, delete on public.favorites to authenticated;
revoke delete on public.series, public.works, public.comments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 索引
-- ---------------------------------------------------------------------------
create index if not exists idx_works_status        on public.works(status);
create index if not exists idx_works_series        on public.works(series_id);
create index if not exists idx_works_published_at on public.works(published_at desc);
create index if not exists idx_chapters_work      on public.work_chapters(work_id);
create index if not exists idx_chapters_status     on public.work_chapters(status);
create index if not exists idx_comments_work       on public.comments(work_id);
create index if not exists idx_comments_user       on public.comments(user_id);
create index if not exists idx_comments_status     on public.comments(status);
create index if not exists idx_favorites_work      on public.favorites(work_id);

-- =============================================================================
-- 安装完后，在 Supabase SQL Editor 里手动执行这一行把自己提为管理员：
--   update public.profiles set role = 'admin' where id = '你的用户UUID';
-- （用户 UUID 在 Authentication → Users 里复制。）
-- =============================================================================
