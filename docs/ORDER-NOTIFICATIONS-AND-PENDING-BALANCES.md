# Order notifications and pending balances

## Inventory sheet
The app now uses the existing `comment` column as the admin-facing Payment note and adds `Pending Amount` (KSh) as a numeric field. The existing `Sale Price` column is no longer shown or written by the application; its old values are left untouched to avoid deleting historical data. `ensureInventoryColumns()` appends `Pending Amount` if missing.

## Admins sheet
Keep the `mail` column (or `Email`) in the Admins header row. Add one valid address per active admin. The notification sender reads addresses from active rows only and removes duplicates.

## Apps Script email bridge
1. Replace the contents of the existing Shoe Studio Apps Script project with `docs/drive-upload-bridge.gs`.
2. Keep Script Properties `DRIVE_FOLDER_ID` and `UPLOAD_TOKEN` unchanged.
3. Save. In the function selector choose `authorizeShoeStudioMail` and click Run once; approve the Mail permission when Google asks. This function only requests authorization and does not send an email.
4. Deploy > Manage deployments > Edit > New version > Deploy.
5. Keep the same Web App URL and token in Vercel (`GOOGLE_DRIVE_UPLOAD_WEB_APP_URL`, `GOOGLE_DRIVE_UPLOAD_TOKEN`). No new Vercel secrets are required.

## Behaviour
- A booking email is sent to all unique email addresses in active Admins rows. It contains product image, shoe details, customer contact details, order reference and message.
- Email failure does not delete or reject the booking; the booking remains saved. The booking API returns `emailSent` so monitoring can distinguish notification delivery.
- Hot Sale is automatically enabled after two distinct normalized phone numbers have enquired about the same Shoe ID. A repeat enquiry from the same phone number is not counted twice.
- Pending Payments in Business Analysis sums the numeric `Pending Amount` for the selected stock-batch filter.
