# Shoe Studio — Shoe Shop & Booking Management

A GitHub-ready Next.js application for a shoe shop. Customers can browse inventory and send booking enquiries. Administrators sign in using accounts stored securely in the Google Sheets `Admins` tab. Morisky is Super Admin; Mon and Kamala are Admins with bookings and inventory access. Google Sheets is the initial data store; product photos are uploaded directly to a dedicated Google Drive folder and their links are stored in the Inventory sheet.

> **Deployment note:** This is a migration starter based on the Apps Script files supplied for this project. The application code and integration routes are included, but the live Google Sheet has not been inspected from this workspace and the production deployment has not been tested against your account. Complete the setup and verification checklist below before publishing the site to customers.

## Stack

- Next.js App Router + React + TypeScript
- Google Sheets API using a Google service account
- Server-side admin authentication with an HTTP-only signed session cookie
- Vercel deployment
- Google Drive product image links (served through a same-origin image proxy) and authenticated admin photo uploads to a configured Drive folder

## Features included

### Customer storefront
- Public shoe catalogue sourced from the `Inventory` tab
- Search by item ID, category, and size
- Category, size, and maximum-price filters
- Product image, size, status, and KSh price
- Booking/enquiry form with a generated reference number

### Admin portal (`/admin`)
- Protected administrator sign-in
- Customer booking list and status updates: New Enquiry, Confirmed, Completed, Cancelled
- Inventory list and status updates: Available, Reserved, Sold, including sold-price entry and automatic profit-margin calculation
- Hot Sale badges and promotional sale prices
- Available shoes sorted first, then Reserved, then Sold; only Available shoes can be booked
- Add inventory items with a photo upload to Google Drive; store the returned image link in Google Sheets
- Basic inventory totals

### Administrator roles
- **Morisky — Super Admin:** full administrator access, including creating accounts, changing roles, activating/deactivating accounts, and resetting passwords.
- **Mon — Admin:** bookings and inventory access, including adding shoes.
- **Kamala — Admin:** bookings and inventory access, including adding shoes.
- Role permissions are checked by server-side API routes. Hiding a tab in the browser is not the security boundary. The server re-reads the Admins sheet on protected requests, so a deactivated account loses access.

### Included project documentation
- `docs/legacy-google-apps-script-backend.js` — archived supplied Apps Script backend
- `docs/legacy-index.html` — archived supplied Apps Script frontend
- `docs/legacy-daily-report.js` — archived daily report script
- `docs/GOOGLE_SHEETS_SCHEMA.md` — required spreadsheet structure

The legacy Apps Script files are reference material only; they are **not** loaded by the Next.js application. The old plain-text-password approach must not be used for the new site.

## 1. Google Sheets setup

1. Open Google Cloud Console and create/select a project.
2. Enable the **Google Sheets API**.
3. Create a service account and generate a JSON key.
4. Share your Google spreadsheet with the service account's `client_email` as an **Editor**.
5. Keep the JSON key private. Do not commit it to GitHub.
6. Copy `.env.example` to `.env.local` and fill in the values.
7. Run `npm install`, then `npm run sheets:setup` to create any missing tabs and headers. The script does not replace existing populated rows.
8. Run `npm run admins:setup` to replace the old `Admins` tab with the secure administrator schema and set new passwords for the three administrators.

Spreadsheet ID currently configured in the template: `1PRPDzi_Y9_I_8PTGPByvuAfek72Pfzdz3USzez5_jic`.

Expected tabs and columns are documented in `docs/GOOGLE_SHEETS_SCHEMA.md`. Confirm these headers match the live spreadsheet before using real data. The new application authenticates from the `Admins` tab using scrypt password hashes and unique random salts; it never uses plain-text passwords.

## 2. Configure administrator login and roles

The administrator accounts are stored in the Google Sheets `Admins` tab, not in `.env.local`:

| Username | Role | Access |
|---|---|---|
| `morisky` | Super Admin | Full access and administrator account management |
| `mon` | Admin | Bookings and inventory |
| `kamala` | Admin | Bookings and inventory |

The setup script asks you to enter **new** passwords for all three accounts. Password input is hidden in an interactive PowerShell terminal. Each password is converted locally to a scrypt hash with its own random salt before being written to Google Sheets. The old plain-text password cells are cleared and replaced. Use new passwords of at least 12 characters because the old credentials were shared in a chat and should be considered exposed.

Run:

```powershell
npm run admins:setup
```

Type `REPLACE ADMINS` when prompted. Then enter a new password for `morisky`, `mon`, and `kamala` when prompted. Do not reuse the passwords previously present in the old sheet.

Only the `SESSION_SECRET` remains in `.env.local` for authentication. Generate it in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the result into `SESSION_SECRET`. Do not add `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, or `ADMIN_PASSWORD_SALT`; those single-admin settings are no longer used.

After the initial setup, Morisky can manage accounts from **Administrator accounts** in the admin dashboard. Admins can be created, assigned roles, activated/deactivated, or have passwords reset there. The Super Admin account cannot deactivate or demote itself from the dashboard.

## 3. Configure product images

Existing Google Drive links in the `Inventory` tab's `Picture` column are supported. The storefront converts Drive file links into a same-origin `/api/product-image` request so browser referrer/hotlink restrictions are less likely to block them. Each Drive photo must still be shared as **Anyone with the link → Viewer**. The API proxy only accepts a Drive file ID and returns image content; it does not expose Google credentials.

Configure the Apps Script upload bridge by following `docs/DRIVE-UPLOAD-SETUP.md`, then add `GOOGLE_DRIVE_UPLOAD_WEB_APP_URL` and `GOOGLE_DRIVE_UPLOAD_TOKEN` to Vercel. The bridge stores files in your own Drive quota and makes each uploaded image viewable by link.

## 4. Verify the Google Sheets connection

After deployment, open `/api/health`. It reports whether the required environment variables are present, whether the server can read the `Inventory` tab, the row count, and the headers. It never returns credentials. If it reports permission denied, share the spreadsheet with the service account's `client_email` as Editor. If it reports missing configuration, correct the Vercel environment variables and redeploy.

Required Vercel variables (Production environment at minimum):
- `GOOGLE_SHEETS_SPREADSHEET_ID` — the ID between `/d/` and `/edit` in the Google Sheets URL.
- `GOOGLE_SERVICE_ACCOUNT_JSON` — the complete JSON key contents, not the project name, key filename, or service-account email. Paste it as one value; keep it private.
- `SESSION_SECRET` — at least 32 random characters.
- `GOOGLE_DRIVE_UPLOAD_WEB_APP_URL` — your deployed Apps Script `/exec` URL.
- `GOOGLE_DRIVE_UPLOAD_TOKEN` — the matching private upload token stored in Apps Script Script Properties.

After changing environment variables, redeploy so the new deployment receives them.

## 5. Run locally

```bash
npm install
Copy-Item .env.example .env.local
# Fill in .env.local first
npm run sheets:setup
npm run admins:setup
npm run dev
```

Open `http://localhost:3000` for the shop and `http://localhost:3000/admin` for the admin portal.

## 6. Upload to GitHub

Create an empty repository, then from this folder run:

```bash
git init
git add .
git commit -m "Initial professional shoe shop website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Check before pushing that `.env.local`, service-account JSON keys, and passwords are not staged. `.gitignore` excludes local environment files.

## 7. Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Add every required variable from `.env.example` in Vercel → Project → Settings → Environment Variables.
3. Deploy.
4. Test the public inventory, submit a test booking, sign in to `/admin`, and update a test booking and stock status.
5. Remove test rows only after confirming which records are safe to delete.

## Important verification and current scope

- The live spreadsheet tab names and header row have not yet been independently verified. Confirm them before connecting production data.
- Current admin tools cover booking status, stock status, and adding products. Full edit/delete flows, historical audit screens, advanced sales charts, email notifications, and the old daily scheduled email report have not yet been migrated into this Next.js version.
- The `Admins` tab is the login source. Run `npm run admins:setup` once to migrate away from the legacy `Email` / `Password` plain-text columns. Do not manually enter plain-text passwords in this sheet.
- The public booking endpoint validates the selected item and writes an enquiry to `Orders`; it does not automatically mark the shoe as Reserved. Confirm the desired reservation policy before enabling automatic stock changes.
- Add rate limiting / CAPTCHA and a privacy notice before broad public launch to reduce spam and explain how customer phone numbers are handled.
- Verify currency, business name, contact details, product categories, and legal/privacy wording before launch.

## Project structure

```text
app/
  api/                 # Public and protected server routes
  admin/               # Administrator portal
  globals.css          # Responsive visual system
  layout.tsx
  page.tsx             # Customer storefront
lib/
  auth.ts              # Signed sessions, sheet-backed password verification and role checks
  sheets.ts            # Google Sheets API helpers
scripts/
  setup-sheets.mjs     # Create missing sheet tabs/headers
  setup-admins.mjs     # Replace legacy Admins data with salted password hashes and roles
public/images/         # Local fallback image only
 docs/                 # Spreadsheet schema and archived Apps Script source
```
