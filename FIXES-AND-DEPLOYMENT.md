# Shoe Studio fixes in this package

1. Google Sheets credentials are parsed and validated server-side with clearer configuration and permission errors.
2. The public inventory API reads the Inventory tab independently (a missing Orders tab no longer blocks shoe photos/catalogue).
3. Inventory fields are matched by spreadsheet header names, with legacy column positions as fallback.
4. Existing Google Drive Picture links are converted to a same-origin image proxy route.
5. All API routes explicitly use the Node.js runtime.
6. Admin and storefront clients handle non-JSON responses without throwing `Unexpected token` and show HTTP status plus a short response preview.
7. `/api/health` safely tests the Google Sheets Inventory connection and reports row count/headers without revealing secrets.

## Deploy

Replace the repository contents with this folder, commit and push, then wait for Vercel deployment. Verify `/api/health` before testing admin login. Do not run `npm run admins:setup` again unless intentionally resetting all three admin passwords.

## Google setup checks

- Vercel Production env must contain `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and `SESSION_SECRET` (32+ characters).
- `GOOGLE_SERVICE_ACCOUNT_JSON` must be the full service-account JSON key contents.
- Share the Google spreadsheet with the service account `client_email` as Editor.
- Admins tab must have headers: `Username`, `PasswordHash`, `Salt`, `Role`, `Active`.
- Inventory tab should have the user's existing headers, including `ID`, `Picture`, `Target Price`, `Status`, `Category`, and `size`.
- Drive image files must be shared as Anyone with the link / Viewer.
