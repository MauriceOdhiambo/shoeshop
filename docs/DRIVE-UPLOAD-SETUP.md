# Enable direct photo uploads to your Google Drive

This project uses a small Google Apps Script web app as a secure upload bridge. It writes uploaded images into a folder in **your Google Drive**, so files use your Drive storage rather than relying on a service account's Drive quota. The shoe's public thumbnail link is then saved into the Inventory sheet's `Picture` column when the Add Shoe form is submitted.

## A. Create the Drive folder

1. Open Google Drive using the Google account where you want Shoe Studio photos stored.
2. Create a folder named `Shoe Studio Photos`.
3. Open the folder and copy its ID from the URL. It is the text after `/folders/`.

## B. Create the Apps Script upload bridge

1. Visit https://script.google.com and create a new project named `Shoe Studio Drive Upload`.
2. Open the project's `Code.gs`, remove the sample function, and paste the complete contents of `docs/drive-upload-bridge.gs` from this ZIP.
3. In Apps Script, open **Project Settings** (gear icon), find **Script Properties**, and add these two properties:
   - `DRIVE_FOLDER_ID` = the folder ID copied in section A.
   - `UPLOAD_TOKEN` = a new long random secret. Generate one locally, for example in PowerShell: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Do not share this token in chat or commit it to GitHub.
4. Click **Deploy → New deployment**.
5. Select type **Web app**.
6. Set **Execute as** to **Me** (your Google account).
7. Set **Who has access** to **Anyone**, if that option is available in your account. Requests are protected by the secret token.
8. Click Deploy and authorize the script to manage files in your Google Drive.
9. Copy the Web app URL ending in `/exec`.

## C. Add two Vercel environment variables

In Vercel → Shoe Studio → Settings → Environment Variables, add:

- `GOOGLE_DRIVE_UPLOAD_WEB_APP_URL` = the Apps Script Web app `/exec` URL.
- `GOOGLE_DRIVE_UPLOAD_TOKEN` = the exact same secret you saved as the Apps Script `UPLOAD_TOKEN` property.

Add them to Production (and Preview/Development if needed), save, and redeploy.

## D. Test

1. Sign in to `/admin`.
2. Open **Add new shoe** and choose a JPG, PNG or WEBP photo up to 4 MB.
3. Wait for the `Photo uploaded to Google Drive` message.
4. Enter the shoe details and click **Save shoe to inventory**.
5. Confirm the new row's `Picture` cell in the Google Sheets `Inventory` tab contains a `drive.google.com/thumbnail?...` link.

If the upload service returns an HTML sign-in page or a permission error, check that the Web App is deployed with access set to Anyone, that the URL ends in `/exec`, and that the Vercel token exactly matches the Script Property. If you change Apps Script code, create a **new deployment version** and update Vercel only if the Web app URL changes.
