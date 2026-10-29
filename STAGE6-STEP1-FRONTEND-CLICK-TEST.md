# Stage 6 · Frontend Click-through Patch

## What changed
- Made the six sample cards on `works.html` clickable.
- Made the three sample cards on `characters.html` clickable.
- Added `entry.html` to render a matching detail view from URL query parameters.
- Added keyboard focus styling and return-to-list links.

## Important limitations
This patch only fixes frontend navigation and example detail rendering. It does **not** create or edit persistent records, connect the archive to Supabase, upload media, or implement version history. Example text remains placeholder content. No SQL was executed and no Supabase configuration was changed.

## Manual test
1. Open `works.html` and click each of the six cards; confirm `entry.html` opens with the matching title.
2. Use the return link to go back to `works.html`.
3. Open `characters.html` and click each of the three cards; confirm the corresponding detail view opens.
4. Try an unknown URL such as `entry.html?type=work&id=missing`; confirm the not-found message appears.
5. Confirm filters still hide/show work cards as before.

## Next
After this navigation patch is reviewed, the next implementation stage should be the archive editor and data model design. Database changes remain separate and require explicit approval.
