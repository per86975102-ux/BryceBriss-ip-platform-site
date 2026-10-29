# Security Report

## Current Security Status

This report describes known controls and limitations in the static frontend package. The V3 backend has not been deployed or tested. Do not interpret frontend checks as proof that database security is effective.

## Frontend and Deployment Notes

- `supabase-config.js` is a placeholder and contains no configured live project credentials in this package.
- Browser code may contain a Supabase publishable/anon key when configured; it must never contain a `service_role` key, database password, or private key.
- Client-side filtering and hidden buttons are not security boundaries. RLS, grants, constraints, and server-side checks must enforce access control.
- The admin interface calls `public.is_admin()`. The V3 database must implement a narrowly scoped function that does not disclose role data and correctly evaluates the current authenticated user.
- Draft work and chapter visibility must be enforced in the database, including parent-work and parent-series publication state where applicable.
- Comment insertion must require authentication, enforce `user_id = auth.uid()`, and validate that the target work is eligible for comments.
- Favorites must be scoped to the authenticated owner.
- The current `characters.html` page is static and does not provide persistent character/world management.

## Known Risks and Outstanding Work

1. RLS, grants, triggers, RPC permissions, and all online database permissions are unverified because no V3 SQL was executed.
2. The legacy SQL files are not compatible with the V3 frontend and must not be run for this release.
3. There is no complete comment moderation/reporting interface or demonstrated rate limiting/anti-spam control.
4. Legal pages and contact details may still be draft content; review before public launch.
5. `_headers` is not processed by GitHub Pages. If deployed to Cloudflare Pages, verify the actual response headers after deployment.
6. A complete Content Security Policy (CSP), dependency review, accessibility audit, and cross-browser test have not been completed.
7. Backup, recovery, incident response, and account recovery procedures need operational testing.

## Required Before Production

Use a separate test project, apply only an approved V3 schema after explicit authorization, and execute the validation matrix in `SUPABASE-SETUP.md`. Record results rather than assuming success. Review hosting provider content policies and finalize privacy, terms, copyright, and moderation documentation.
