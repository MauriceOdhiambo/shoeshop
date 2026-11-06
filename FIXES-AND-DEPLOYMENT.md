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

## Inventory upgrades: Google Drive photo uploads, Hot Sale and sales updates

The admin Add New Shoe form accepts an image upload (JPG, PNG, WEBP, etc.; max 4 MB). The upload is sent through a Google Apps Script web app that creates the file in your own Google Drive. When the admin saves the shoe, its public thumbnail link is stored in the Inventory sheet's `Picture` column.

Follow `docs/DRIVE-UPLOAD-SETUP.md` to create the `Shoe Studio Photos` folder, deploy the Apps Script bridge, and configure `GOOGLE_DRIVE_UPLOAD_WEB_APP_URL` plus `GOOGLE_DRIVE_UPLOAD_TOKEN` in Vercel. This approach avoids depending on service-account Drive storage quota.

### Inventory sheet columns and behaviour

The app adds these optional columns to the end of the Inventory header row if missing: `Hot Sale`, `Sale Price`, and `Reserved Date`. Existing inventory columns and rows are retained. Available stock is sorted first, then Reserved, then Sold; Hot Sale items are promoted within each status group. Sold and Reserved items cannot be booked from the public shop. Admins can edit status, actual sold price, Hot Sale flag and promotional sale price in the inventory table.

When changing a shoe to `Sold`, enter its actual sold price before saving. The app calculates the profit margin from the sold price and buying price. Marking an item `Reserved` records the reservation date; returning it to `Available` clears that date.

## Follow-up fix: product photo required and legacy ID format restored

- New inventory records now use the established `SHOE-<13-digit timestamp>` ID format (for example `SHOE-1790782470578`) instead of UUID-based IDs.
- The Add Shoe form requires a successful Google Drive photo upload before it can be saved.
- The inventory API also rejects a new shoe record if its Picture link is empty, preventing placeholder-only listings caused by saving without an uploaded photo.
- Existing shoe IDs and existing inventory rows are not rewritten.
