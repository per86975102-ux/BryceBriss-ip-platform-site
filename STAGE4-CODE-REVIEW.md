# Stage 4 Code Review and Compatibility Report

## Scope

This stage standardizes technical comments and database error text, checks JavaScript syntax and local HTML references, reviews frontend data access, and records the V3 schema contract required by the frontend.

No SQL was executed. No Supabase project, database object, account, policy, or production data was changed. No Stage 5 documentation/deployment work was performed.

## Changes made

- Kept JavaScript identifiers, function names, RPC names, table names, column names, and configuration keys in English or ASCII identifiers.
- Translated Chinese comments in the legacy SQL files into English and changed SQL exception text to English.
- Added prominent warnings to `supabase-schema.sql` and `supabase-schema.v2.sql`: both are legacy schema scripts and must not be executed for the V3 frontend.
- Preserved an existing work's `published_at` timestamp when editing an already-published work; a new timestamp is assigned when a draft is published.
- Preserved an existing chapter's `published_at` timestamp when editing an already-published chapter; a new timestamp is assigned when a draft is published.
- Explicitly cleared the admin page's cached user when running without Supabase configuration.
- Added explicit null ordering to the public work list query.
- Changed the comment submission confirmation so it does not claim a comment is immediately public; publication depends on the database moderation policy.

## Frontend V3 data contract

The current frontend expects these public database objects and fields:

- `public.series`: `id`, `title`, `slug`, `status`, `description`, `created_at`, and `published_at` where used.
- `public.works`: `id`, `series_id`, `title`, `slug`, `summary`, `category`, `language`, `cover_path`, `status`, `published_at`, `created_at`, and `created_by` for inserts.
- `public.work_chapters`: `id`, `work_id`, `chapter_number`, `title`, `body` (structured JSON document), `status`, `published_at`, and `updated_at`.
- `public.comments`: `id`, `work_id`, `user_id`, `body`, `status`, and `created_at`.
- `public.favorites`: `user_id`, `work_id`.
- RPC `public.is_admin()` returning a boolean for the current authenticated user.

The frontend expects `comments.status = 'visible'` for publicly displayed comments. The V3 database design must define the complete allowed status set and its default explicitly.

## Compatibility finding

The existing `supabase-schema.sql` and `supabase-schema.v2.sql` are **not compatible with the V3 frontend**. The legacy schema uses `works.series` and `works.cover_url`, a boolean `comments.is_hidden`, and does not define the `series` or `work_chapters` tables required by the current frontend. These files have been marked as legacy to reduce the risk of accidentally applying them. They were not otherwise migrated or executed in this stage.

The future V3 schema must also provide a narrowly scoped `public.is_admin()` RPC, because `admin.js` calls `client.rpc('is_admin')`. Database RLS must enforce all draft/published visibility rules; frontend filtering is not a security boundary.

## Static checks performed

- JavaScript parser checks (`node --check`) passed for all JavaScript files.
- DOM ID references checked against their associated HTML files: no missing IDs found in `admin.js`, `community.js`, or `read.js`.
- Local HTML resource references checked. Three reported entries were in-page anchor links to `works.html#fiction`, `works.html#essays`, and `works.html#music`; the target HTML file exists. These are not missing files.
- Technical SQL comments and SQL exception strings were checked for remaining Chinese text; none remains in the legacy SQL files.
- No SQL execution, live Supabase request, real browser interaction, accessibility audit, or end-to-end test was performed.

## Known limitations / items for later verification

- `document.execCommand()` is deprecated by browser standards. It remains in the current editor for compatibility but should be tested in target browsers and replaced if necessary in a future approved change.
- The V3 database schema has not been applied, so the frontend's table/column/RLS/RPC contract cannot yet be verified against a live database.
- The frontend assumes the V3 comment status value `visible`; the schema must align its status constraints and default with this behavior.
- RLS and grants must independently prevent users from reading drafts, editing other users' records, self-assigning admin privileges, or writing comments as another user.
- Supabase URL and publishable/anon key remain blank in `supabase-config.js`; live mode is therefore not configured in this package.
