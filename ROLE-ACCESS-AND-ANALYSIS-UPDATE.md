# Shoe Studio – Role Access & Stock Analysis Update

## Role permissions

- **Admin:** customer bookings and inventory operations only. The Add Shoe action is inside Inventory. Buying costs are not included in the Admin inventory API response and are not shown in the Admin interface.
- **Super Admin:** all Admin functions plus buying-cost visibility/editing, business analysis, and administrator account management.
- Both roles can change their own password from **My password**. The current password is verified and the new password must be at least 12 characters.

## Stock batch analysis

The analysis view is Super Admin only. It interprets the highest numeric `Stock Type` value as the newest batch. For example, if stock types 1 and 2 exist, 2 is labelled **New / Latest** and 1 is **Old**. When stock type 3 is added, 3 becomes **New / Latest**, while 1 and 2 are **Old**. The filter supports all batches, latest batch, or older batches.

## Deployment

1. Back up the current GitHub repository.
2. Replace the project files with the contents of this ZIP.
3. Commit and push to GitHub, then wait for Vercel deployment.
4. Do not run `npm run admins:setup` or `npm run sheets:setup`.
5. Keep existing Vercel environment variables unchanged.

No Google Sheets columns or existing inventory rows need to be deleted or renamed. The new password endpoint updates only the signed-in administrator's `PasswordHash` and `Salt` cells.
