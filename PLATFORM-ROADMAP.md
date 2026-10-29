# Platform Roadmap

## Current State

- Brand website pages and navigation are present.
- V3-oriented frontend interfaces exist for series, works, chapters, comments, and favorites.
- Static checks have been performed; live database behavior has not been verified.
- The character/world page is a static showcase, not a content management system.
- Legacy SQL files are explicitly not compatible with the current V3 frontend.

## Next Work Items

1. Review and approve a separate V3 schema specification and SQL migration before any database operation.
2. Apply the approved schema only to a dedicated test project after explicit authorization; validate RLS, grants, triggers, status constraints, and `public.is_admin()`.
3. Test authentication, work/series/chapter CRUD, public reading, comments, favorites, and draft visibility in a browser.
4. Replace or reassess the deprecated rich-text editing API after browser compatibility testing.
5. Build a dedicated character/world management module: create, edit, archive/delete, draft/publish, search/filter, and persist records.
6. Add character relationships, work associations, world/region/system links, and change history/versioning.
7. Add image storage, profile/password recovery, moderation/reporting, and anti-spam/rate limiting.
8. Finalize privacy, terms, copyright, moderation, backups, monitoring, accessibility, and deployment security.

## Scope Note

Do not begin database execution or production deployment merely because a static page looks complete. Each backend-dependent feature needs an approved schema contract and actual permission tests.
