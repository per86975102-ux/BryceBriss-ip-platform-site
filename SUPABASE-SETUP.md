# Supabase Setup and V3 Validation Plan

## Status

The current frontend is not connected to a live Supabase project. `supabase-config.js` contains placeholders. This document is a preparation and test plan; it does not authorize or perform database changes.

## Important: Use the V3 Schema

- **`supabase-schema.v3.sql`** is the fresh-install schema that matches the current V3 frontend. Use this in a new, disposable test project.
- `supabase-schema.sql` and `supabase-schema.v2.sql` are legacy and do **not** match the V3 frontend. Do not run them for this release. If you already ran one of them on a project, treat that project as needing a separate, reviewed migration (not provided here).

After running v3, promote yourself to admin in the SQL Editor:
```sql
update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';
```

## Confirmed V3 Product Rules

- **Comments publish immediately:** a signed-in reader can comment only on a published work whose parent series (if any) is published. The insert policy requires `status = 'visible'`; clients cannot set a new comment to `hidden` or moderate existing comments.
- **Archive, do not physically delete works or series:** the admin UI changes a work's status to `archived`. Existing comment rows retain their `work_id`; ordinary client roles have no `DELETE` privilege on works, series, or comments.
- **Archived content is private to admins:** public read policies require the work and its parent series (if any) to be published. Admins may inspect comment history for archived works and may hide/restore individual comments.
- A comment that was explicitly hidden remains hidden if its work is later republished.

## Frontend Contract to Match

The V3 schema must define and secure the following objects and fields used by the frontend:

- `public.series`: `id`, `title`, `slug`, `status`, `description`, `created_at`, and `published_at` where queried.
- `public.works`: `id`, `series_id`, `title`, `slug`, `summary`, `category`, `language`, `cover_path`, `status`, `published_at`, `created_at`, and `created_by` for inserts.
- `public.work_chapters`: `id`, `work_id`, `chapter_number`, `title`, `body` as structured JSON, `status`, `published_at`, and `updated_at`.
- `public.comments`: `id`, `work_id`, `user_id`, `body`, `status`, and `created_at`. The frontend currently treats `status = 'visible'` as publicly displayable.
- `public.favorites`: `user_id`, `work_id`.
- `public.is_admin()`: a narrowly scoped RPC returning a boolean for the currently authenticated user.

The V3 schema must also specify all status values/defaults, foreign keys, indexes, RLS policies, grants/revokes, triggers, and safe signup profile creation. Database policies—not just frontend filtering—must protect drafts and enforce ownership.

## Safe Preparation Sequence

1. Create a separate disposable/test Supabase project; do not start with a production project.
2. Review the V3 schema specification and the exact SQL artifact before execution.
3. Back up any existing data before a migration. The current project history indicates that the public schema was previously empty, but verify the actual target project independently.
4. Apply the approved V3 SQL only after explicit authorization and only to the intended test project.
5. Add the Supabase Project URL and public publishable/anon key to `supabase-config.js` for local testing. Never use a `service_role` key in browser code.
6. Configure authentication Site URL and Redirect URLs to match the local test address and eventual deployment domain.
7. Create separate anonymous, reader, and administrator test sessions.

## Required Validation Matrix

| ID | Test | Expected result |
|---|---|---|
| V3-01 | Anonymous visitor lists works | Only published works are returned |
| V3-02 | Anonymous visitor requests a draft work/chapter by ID | No draft content is disclosed |
| V3-03 | Reader creates a comment on a published work | Accepted only when signed in and user identity matches the session |
| V3-04 | Anonymous visitor attempts to create a comment or favorite | Rejected |
| V3-05 | Reader attempts to write another user's favorite/comment | Rejected |
| V3-06 | Reader attempts to assign themselves administrator privileges | Rejected |
| V3-07 | Administrator calls `public.is_admin()` | Returns `true` only for an authorized administrator |
| V3-08 | Non-administrator calls `public.is_admin()` | Returns `false` without leaking role data |
| V3-09 | Published chapter is linked to a draft parent work | Chapter remains private |
| V3-10 | Work/chapter edit preserves publication timestamp | Timestamp remains stable unless publishing status changes according to the agreed rules |
| V3-11 | Comment status is not `visible` | Comment is not shown publicly |
| V3-12 | User signs out and revisits protected admin actions | Access is denied |
| V3-13 | Reader inserts a comment with `status = hidden` or updates comment status | Rejected by grants/RLS |
| V3-14 | Reader posts a comment on an archived work or a work in an archived series | Rejected |
| V3-15 | Admin archives a work | Work is hidden publicly; comment rows and `work_id` remain unchanged |
| V3-16 | Anonymous/reader requests comments for an archived work by direct API query | No comment history disclosed |
| V3-17 | Admin selects an archived work in the admin comment-history panel | Visible and hidden comments are available for moderation |
| V3-18 | Reader attempts physical deletion of a work, series, or comment | Rejected by table privileges |
| V3-19 | Reader favorites a work whose parent series is archived | Rejected |
| V3-20 | Public comment query embeds author profile and work/series | Only visible comments on published work/series display; author display name resolves |


Record the actual result, test account type, date, and relevant error message for every test. Do not mark any test as passed until it has been run.

## Static Revision Note

The revised package includes a reviewed SQL artifact and frontend wiring, but this project has **not** been connected to Supabase. No SQL in this package has been executed, and all validation rows remain pending until tested against a disposable project. The schema remains a fresh-install script, not a migration for an existing database.

## Rollback and Recovery

Do not improvise rollback SQL. Before any approved migration, document the exact migration, take a backup when applicable, and prepare a reviewed rollback/recovery plan. Test restoration independently.
