# Deployment Guide

## Current Release Status

This package contains a static website frontend and an unfinished V3 backend integration. The pages can be previewed locally, but the Supabase configuration is blank. Database-dependent features are not ready for production use.

The `characters.html` page is currently a static showcase. Character/world creation, editing, relationships, and persistent storage have not been implemented. Do not treat its example cards as a working content management system.

## Local Preview on Windows 11

1. Download and extract the ZIP archive to a normal folder.
2. Open `index.html` in a modern browser for a basic visual check.
3. If browser restrictions affect scripts or resources, use a local HTTP server. Python is optional, not required. If Python is already installed, open PowerShell in the project root and run `python -m http.server 8000`, then visit `http://localhost:8000`.
4. Check navigation, layout, responsive behavior, and browser-console errors.

A successful local preview does not prove that authentication, database reads/writes, permissions, or cross-device synchronization work.

## Hosting Options

### GitHub Pages

- Publish the project root directory; `index.html` must be at the published root.
- Configure Pages under repository Settings.
- GitHub Pages does not process `_headers`; do not rely on that file for response security headers.
- Confirm HTTPS is enabled.

### Cloudflare Pages

- Connect the repository and use the project root as the output directory for this plain static site.
- `_headers` is supported, but review the current header rules and test the deployed site before relying on them.

## Production Readiness Gate

Do not announce this package as a fully functioning dynamic platform until all of the following are complete:

1. A V3 schema has been reviewed and approved, then applied only to a disposable/test Supabase project.
2. The schema matches the frontend contract in `STAGE4-CODE-REVIEW.md`, including `series`, `works`, `work_chapters`, `comments`, `favorites`, and the `public.is_admin()` RPC.
3. Row Level Security, grants, triggers, status constraints, and draft visibility have been tested with anonymous, reader, and administrator accounts.
4. `supabase-config.js` contains only the correct project URL and public publishable/anon key. Never put a `service_role` key, database password, or private key in frontend files or Git.
5. Authentication redirect URLs, email confirmation, password recovery, and account lifecycle behavior have been tested.
6. Legal pages and contact details are finalized, and content moderation, backups, and incident response are planned.
7. Browser tests pass on the intended desktop and mobile browsers.

## Legacy SQL Safety Warning

`supabase-schema.sql` and `supabase-schema.v2.sql` are legacy files and are not compatible with the current V3 frontend. **Do not execute either file as a V3 installation or migration.** A dedicated V3 SQL specification and reviewed migration must be prepared separately. No SQL is executed by this guide.

## Content and Platform Policies

Review the current GitHub Pages or Cloudflare Pages acceptable-use rules before publishing. Apply appropriate content classification and moderation, and do not assume that all mature content is permitted by the hosting provider.
