# Shoe Studio professional storefront and admin update

## Changes
- Removed the large promotional hero so the public homepage opens directly on the shoe collection.
- Kept inventory filtering, availability-first ordering, Hot Sale labels, booking/enquiry flow and photo zoom.
- Fixed the booking form reset bug by retaining the form element before awaiting the network request. React clears `event.currentTarget` after the event callback returns, so reading it after `await` caused the reported null `reset` error.
- Restyled the administrator workspace and sign-in page with a dark operations interface.
- Added dashboard metrics for total inventory, available pairs, reserved pairs, sold pairs, recorded sales revenue and gross profit (sold price less buying cost).
- Kept the History sheet as an audit source; it is not shown as customer-facing content.
- Removed the technical session/security explanation from the visible admin footer.

## Deployment
1. Back up the current GitHub repository.
2. Replace the repository contents with the contents of this project folder, preserving `.env` values only in Vercel (never commit secrets).
3. Commit and push to GitHub.
4. Wait for Vercel to deploy, then test the public collection, a booking, admin sign-in, inventory editing and photo zoom.
5. Do not run `npm run admins:setup` or `npm run sheets:setup` for this visual/booking fix.

## Verification
The updated `app/page.tsx` and `app/admin/page.tsx` passed TypeScript TSX syntax transpilation. A full Next.js production build was not completed because `npm install` timed out in this environment. Verify the Vercel build log after pushing.
