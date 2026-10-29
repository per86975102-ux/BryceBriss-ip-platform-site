# Changelog

## Stage 5 — Documentation, Deployment, and Verification Readiness (2026-10-28)
- Rewrote deployment guidance to distinguish local visual preview from a production dynamic release.
- Replaced legacy Supabase installation steps with a V3 contract, safe preparation sequence, and explicit validation matrix.
- Updated the test report to separate passed static checks from unexecuted backend/browser tests.
- Updated the security report with current limitations and production requirements.
- Clarified that `characters.html` is a static showcase and does not yet implement character/world creation, editing, or persistent storage.
- Explicitly warned against running the legacy SQL files for the V3 frontend.
- No SQL was executed and no Supabase project or database was modified.

## Stage 4 — Code Review and Compatibility
- Standardized technical comments and database error strings in English.
- Marked legacy SQL files as incompatible with the V3 frontend.
- Preserved publication timestamps when editing already-published works and chapters.
- Added static JavaScript, DOM ID, and local resource checks.

## Third Round (2026-10-26)
- Tightened public profile reads and added a column-level privilege verification query to the legacy migration.
- Added an index supporting comment-author policy checks.
- Clarified that GitHub Pages does not process `_headers`.

## Second Round (2026-10-26)
- Added database-side admin checks, role protection, triggers, foreign keys, and published-work restrictions to the legacy schema.
- Updated the admin frontend to use the `is_admin()` RPC.
- Added draft legal pages and basic deployment files.

## First Round (2026-10-26)
- Added community, admin, and Supabase integration scaffolding.

## V3 Schema Revision Package — 2026-10-27

- Confirmed comment policy: comments publish immediately; authenticated inserts must target a published work and published parent series, and must use `status = 'visible'`.
- Confirmed deletion policy: works and series are archived rather than physically deleted through ordinary client access; comments retain their required `work_id` and ordinary clients cannot physically delete comments.
- Public comment and chapter policies now require the parent work and its parent series (if present) to be published. Administrators retain access to archived-work comment history.
- Added explicit table grants/revokes alongside RLS policies.
- Updated community favorite operations to filter by the signed-in user and show read errors instead of silently swallowing them.
- Updated comment success messaging for immediate publication and added author display-name joins for public comments.
- Added an administrator comment-history panel for published, draft, and archived works, including hide/restore actions.
- Distinguished successful work save/archive operations from subsequent list-refresh failures.
- Static checks only; SQL was not executed and no Supabase project was connected.


## V3 Independent Audit and Local Hardening (2026-10-28)

- Replaced anonymous-user `getUser()` startup checks with `getSession()` handling; network/session errors now fail closed in the admin page without blocking public community content.
- Added explicit Supabase configuration status and validation for incomplete, malformed, non-HTTPS, API-path, and detected secret/service-role credentials. No project URL or key was supplied, so configuration remains blank.
- Clear administrator content and comment history on sign-out or loss of session; synchronize sign-in/sign-out events across tabs; make per-list errors visible without aborting all remaining lists.
- Restricted comment INSERT and UPDATE grants in the V3 SQL draft to only `user_id/work_id/body` and `status` respectively. The SQL remains unexecuted and is still fresh-install-only.
- Fixed homepage 390px horizontal overflow and stabilized works-category anchors when live cards replace static cards.
- Ran static checks and Chromium local HTTP smoke tests. Real database/Auth CRUD, RLS, Storage, and production verification remain untested.
