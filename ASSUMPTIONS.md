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
