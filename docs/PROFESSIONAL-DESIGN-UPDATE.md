# Shoe Studio professional storefront and admin redesign

This update is based on the latest Photo-ID-Fix project and retains the Google Sheets, Google Drive upload bridge, product image proxy, inventory, booking, admin login, and role-permission API routes.

## What changed

- Replaced the previous “The latest collection / Find your next favourite pair” hero copy with a more editorial Shoe Studio brand hero.
- Refined storefront typography, spacing, product cards, filters, status labels, pricing, responsive layout, and footer styling.
- Kept available stock first in the storefront sort order; Hot Sale items are prioritised within the same status group.
- Added double-click/double-tap product photo enlargement with a full-screen lightbox and close control.
- Redesigned the admin sign-in screen, management header, navigation, KPI cards, content headings, tables, and add-shoe form styling.
- Updated page title and description metadata.

## Files changed

- `app/page.tsx`
- `app/admin/page.tsx`
- `app/globals.css`
- `app/layout.tsx`

No Google Sheets schemas, credentials, Apps Script deployment URLs, upload tokens, or administrator records were changed.

## Deployment

1. Extract the ZIP.
2. Replace the project files in the existing GitHub repository with the files from `shoeshop-github`.
3. Commit and push to the connected branch.
4. Wait for Vercel to deploy.
5. Test the storefront on desktop and mobile; double-click (desktop) or double-tap (mobile) a product photo to enlarge it.
6. Sign in to `/admin` and check bookings, inventory, adding a shoe, and administrator permissions.

Do not rerun `npm run admins:setup` as part of this visual update.
