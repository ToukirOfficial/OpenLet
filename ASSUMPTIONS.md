# Assumptions

Decisions the PRD and FEATURES.md don't make. Change any of these by telling me.

## Accounts and roles
- **Manager can edit workspace settings** (reminders, priorities, retention). Only the Owner manages the team, sees the audit log, runs the full data export and deletes the workspace.
- **Staff** can do all day-to-day work (properties, tenants, tenancies, ledger, repairs, documents, messages), but can't use settings, reports' CSV or exports. Staff can view reports on screen.
- **Deleting** properties, tenants and tenancies with ledger history is blocked; they're archived instead. Owner and Manager can delete records that have no history.
- Tenants log in the same way as staff (email + password + code; see open question 1). One user can be a staff member in one workspace and a tenant in another; the role is per workspace.
- The workspace that created a tenant invite owns that tenant; a tenant in two workspaces switches between them in the portal.
- Invites expire after 7 days. Email codes expire after 10 minutes, with 5 tries. Reset links expire after 30 minutes.
- Access token 15 minutes, refresh token 30 days, rotated on every use; reusing an old refresh token revokes the whole family.

## Rent and money
- Rent charges are generated **up to 14 days ahead** of the due date, so tenants see the next charge and the "due soon" reminder has a charge to point at.
- The first charge is due on the tenancy start date. For monthly rent, the due day is chosen in the wizard and defaults to the start day.
- A partial first or last period is charged in full (no pro-rata) unless staff add a credit. Pro-rata is not in the PRD.
- A rent change applies to every period that **starts** on or after its effective date.
- Allocation (oldest unpaid charge first) is worked out from the append-only ledger each time, not stored. Reversals undo the original entry and allocation is recalculated.
- "Days overdue" counts London calendar days after the due date of the oldest unpaid charge.
- Payments can't be dated in the future.

## Reminders and compliance
- Reminder emails go out once a day at 08:00 London time.
- Default required documents per property: gas safety (only if the property has gas), EICR, EPC, smoke and CO alarm check; plus HMO licence when the type is HMO. Owner/Manager can change this.
- Certificate reminders go to all Owners and Managers of the workspace.
- Right to Rent follow-up reminder goes 28 days before the permission expires.
- The compliance board shows the latest document of each type per property; older ones stay in history.

## Repairs and contractors
- Default targets: emergency 24 hours, urgent 3 days, routine 28 days.
- Contractor link grace period after closing: 7 days by default (`CONTRACTOR_LINK_GRACE_DAYS`). Re-assigning a repair revokes the old link.
- Contractors can set: scheduled, in progress, completed. Only staff can acknowledge, close or cancel.
- Contractors see tenant contact details only when the workspace setting allows it (off by default).

## Files
- Max upload 15 MB (2 MB in demo). Allowed: PDF, JPEG, PNG, HEIC/HEIF (converted to JPEG). Up to 10 photos per repair.
- Files are stored on local disk under `STORAGE_DIR` (no cloud storage, per the project rules).

## Data retention
- Default: anonymise tenant personal data **6 years** after the tenancy ends (matches the usual HMRC record period). Configurable 1–10 years.
- Anonymising replaces name, email, phone, DOB, emergency contact and guarantor details, deletes Right to Rent evidence and tenant-uploaded photos, and keeps ledger amounts and dates. Messages are kept with the author shown as "Former tenant".
- Ended tenancies are archived (hidden from default lists) 90 days after they end.

## Display
- Dates shown as "2 November 2026"; money as "£1,250.00".
- Postcodes are checked with a UK postcode pattern only (no external lookup service).
- Calendar shows inspections only if the [V1+] inspections feature is built.

## Demo
- Demo has two fixed accounts (landlord Owner and one tenant); everything resets nightly from the seed, and demo emails are stored in the database for the mail viewer, never sent.

## Seed logins (local and demo only, fake data)
`pnpm db:seed` creates the "Calder Valley Lettings" workspace. Every seed login uses the password **openlet-demo-2026** and skips the email code (they're marked as demo accounts).

| Role | Email |
|---|---|
| Owner | owner@demo.openlet.test |
| Manager | manager@demo.openlet.test |
| Staff | staff@demo.openlet.test |
| Tenant | tenant@demo.openlet.test |

The seed also prints a contractor job link for one open repair.

## Portfolio rules (Phase 2)
- A property's status: **vacant** if any unit has no current tenancy, **ending soon** if a current tenancy has notice or ends within 60 days, otherwise **occupied**. The list also shows "2 of 3 let".
- A fixed-term tenancy ends on its end date (PRD: no charges after the end date). To let it roll on, clear the end date.
- The first photo uploaded to a property becomes its cover picture.
- Contractors and properties with history are archived, not deleted. Tenants with tenancies can't be deleted; retention anonymises them later.
- Workspace logos are public images (they appear in emails), served by workspace id.

## Tenancies (Phase 3)
- A unit can't have two tenancies whose dates overlap.
- Weekly and four-weekly rent ignores the due day: it's due every 7 or 28 days from the start date.
- A rent change must start after rent has already been charged; for a past correction, add a one-off charge or credit.
- Recording notice, ending a tenancy or shortening its end date reverses any rent already charged for periods starting after the last day (new reversal entries; nothing is deleted).
- A deposit counts as overdue for protection the set number of days (default 30) after the date received.

## Rent ledger (Phase 4)
- The balance counts charges due up to today. A charge that appears early (up to 14 days before its due date) shows as "upcoming" and isn't owed yet; money paid early shows as credit until then.
- "Overdue" starts the day after the due date (London time).
- A reversal cancels the whole original entry. To correct an amount, reverse it and record the right one.
- Statement PDFs and other generated files are kept for 24 hours, and only the person who asked for one can download it.

## Repairs (Phase 5)
- Repairs get a short number per workspace (#1, #2…) for tenants and contractors to quote.
- A repair logged against a unit is linked to that unit's current tenancy, so its tenants see it and get updates.
- Assigning a contractor to a "reported" repair marks it acknowledged. Assigning again sends a new link and the old one stops working.
- Contractors see the job, access notes, status changes and their own notes. They never see landlord–tenant comments, internal notes or other repairs, and see the tenant's name and phone only if the workspace allows it.
- During the grace period after closing, the contractor can still open the job but can't change it.
- Tenants are emailed when the status changes, a visit is booked, or staff share a comment with them.

## Compliance and reminders (Phase 6)
- The certificate that counts is the one that runs longest; uploading a renewal replaces the old one on the board and stops its reminders.
- A certificate uploaded without an expiry date counts as valid.
- Rent reminders: one "due soon" email per charge; overdue emails at each step for the oldest unpaid charge. If the daily run is missed, only the latest step is sent (earlier ones are skipped, not sent in a burst).
- Certificate, deposit and Right to Rent reminders are grouped into one email per Owner/Manager per day.
- Certificate reminders also go once on the day after expiry.

## Tenant portal and messages (Phase 7)
- Tenants see documents shared with them on their tenancies or their own record, plus shared certificates for the home they live in now (not past homes).
- Tenants never see contractor names, repair costs, internal notes or internal comments.
- Repairs reported by tenants start as "routine"; staff set the real priority.
- A tenant message emails everyone in the team; a team message emails every tenant on the tenancy.
- Tenants can change their phone and emergency contact; name and email changes go through the landlord.

## Dashboard and reports (Phase 8)
- The dashboard is cached in Redis for up to a minute and cleared whenever rent, repairs, tenancies, properties or documents change.
- "Needs attention" shows at most 12 items: urgent ones (long arrears, overdue repairs, expired certificates, unprotected deposits) first.
- Income counts payments recorded in the period, less reversed payments. The maintenance report covers repairs reported in the period that have a cost.
- Every team member can view reports on screen. Downloading a CSV needs Owner or Manager; the full export needs Owner. Both are audited.
- The full export leaves out passwords, tokens, internal file names and user ids.
- Chart bars use a slightly brighter step of the brand green (#13805f) so they read as colour, checked with the palette validator.
