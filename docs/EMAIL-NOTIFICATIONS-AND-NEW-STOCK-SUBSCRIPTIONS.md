# Shoe Studio email notifications and new-stock subscriptions

## Why order emails may not arrive
The booking is saved first; notification delivery is separate. The booking API now returns `emailSent` and a diagnostic `emailError` when the Apps Script bridge rejects the email. Check Vercel Function Logs for the booking API response and Apps Script Executions for MailApp errors.

## Required Admins sheet
Keep the header row with `Username`, `PasswordHash`, `Salt`, `Role`, `Active`, `mail` (or `Email`). Each active row needs a valid email address. Duplicate addresses are sent one email only.

## Apps Script setup
1. Paste the full `docs/drive-upload-bridge.gs` into the existing Apps Script project.
2. Keep Script Properties `DRIVE_FOLDER_ID` and `UPLOAD_TOKEN`.
3. Run `authorizeShoeStudioMail` once in the editor and approve Mail permission.
4. Deploy > Manage deployments > Edit > New version > Deploy.
5. Confirm the Vercel variables `GOOGLE_DRIVE_UPLOAD_WEB_APP_URL` (the `/exec` URL) and `GOOGLE_DRIVE_UPLOAD_TOKEN` exactly match the Apps Script deployment and property.

## Subscribers tab
Create a Google Sheets tab named exactly `Subscribers` with this header row:
`Email | Name | Subscribed At | Active | Unsubscribe Token`

Customers can subscribe from the storefront footer, or tick the optional new-stock updates box while making an enquiry. When an admin adds a new shoe, the app emails active subscribers with the photo, category, size, price and link to the collection. Each email includes a unique unsubscribe link.

## Testing
1. Submit one enquiry using a test customer. Confirm the order appears in `Orders`. The API response should have `emailSent: true`.
2. Subscribe a test email and confirm it appears in `Subscribers`.
3. Add a test shoe from admin. Confirm the test subscriber receives a new-stock alert.
4. Click the unsubscribe link and confirm the subscriber row changes to `FALSE`.

Bookings remain saved if email delivery fails. Check Vercel logs and Apps Script > Executions for the reported reason.
