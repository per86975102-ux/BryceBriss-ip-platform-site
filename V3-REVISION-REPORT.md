# Bryce Briss IP Platform — V3 Revision Report

> This document records the earlier schema/UI revision. The later independent review, browser checks, additional hardening changes, and final verification status are recorded in `V3-UPGRADE-AUDIT.md`.

## Scope and confirmed rules

This package revises the uploaded V3 schema ZIP in an isolated working copy. The original ZIP was not modified.

1. Comments publish immediately. A signed-in user can insert a comment only for a published work whose parent series, if any, is published. New client-created comments must use `visible` status. Moderation is administrator-only.
2. Work deletion is an archive operation. Existing comments remain linked to the work and are not automatically hidden or deleted. Archived work and its comments are not public; an administrator can inspect history and hide/restore individual comments.
3. Series are also protected from ordinary physical deletion so deleting a series cannot detach a work from the series-publication constraint.

## Files changed

- `supabase-schema.v3.sql`
  - `comments.work_id` is now `NOT NULL` with `ON DELETE RESTRICT`.
  - Public comment and chapter visibility checks the work and its parent series publication state.
  - Comment insert policy requires `auth.uid() = user_id` and `status = 'visible'`.
  - Removed ordinary physical-delete policy for works and series; explicit DELETE privileges are revoked for works, series, and comments.
  - Added explicit table grants/revokes for the application tables.
  - Favorite insert policy also checks the parent series is published.
- `community.js`
  - Favorite read/delete/list operations are scoped to the signed-in user.
  - Favorite load failures are surfaced to the user.
  - Public comments query author display name and work/series context; success message says comments are published.
- `admin.html`, `admin.js`
  - Added comment-history panel and work selector.
  - Administrator can view comments on archived works and hide/restore comments.
  - Save/archive success is not incorrectly reported as a write failure when only list refresh fails.
- `SUPABASE-SETUP.md`
  - Added confirmed product rules and expanded validation matrix.
- `CHANGELOG.md`
  - Recorded the revision.

## Static validation performed

- `node --check` passed for every top-level JavaScript file.
- Python HTML parser successfully parsed all top-level `.html` files.
- Static assertions passed for required comment linkage, direct-publish insert condition, public-work condition, DELETE revokes, admin history panel, owner-scoped favorites, and immediate-publish feedback.

## Not performed / known limits

- SQL was not executed or parsed by a live PostgreSQL engine.
- No Supabase project was connected; RLS, GRANT/REVOKE behavior, nested PostgREST joins, and actual account-role behavior remain unverified.
- No live browser/API CRUD tests were run.
- This remains a fresh-install schema, not a migration for an existing database.
- The existing `cover_path` check accepts HTTPS URLs only; a complete Supabase Storage upload flow and bucket policy remain out of scope.
- Public and admin comment display-name joins rely on the declared `comments_user_id_profiles_fkey` relationship and must be verified in the disposable test project.
