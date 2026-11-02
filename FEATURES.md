# OpenLet — Feature list

Free, open-source property and tenancy management for small landlords and small letting agents (about 1–50 properties). Web only.

**Priority:** **[V1]** must be in version 1 · **[V1+]** in version 1 if time allows · **[Later]** not in version 1.

---

## 1. Accounts, workspaces and roles
- [V1] **First-run setup screen:** on a fresh install, the first visitor creates the Owner account and the first workspace (a landlord or a small agency). After that the setup screen is closed for good.
- [V1] Open sign-up for new workspaces is **off by default**. `SIGNUP_ENABLED=true` turns it on for anyone running OpenLet as a hosted service. An Owner can create extra workspaces from inside the app.
- [V1] Email + password login (argon2id) with a 6-digit email code.
- [V1] Password reset.
- [V1] Team roles: **Owner** (everything, including settings, team and deleting the workspace), **Manager** (everything except team and workspace deletion), **Staff** (day-to-day work, no settings, no exports).
- [V1] Invite team members by email.
- [V1] **Tenant accounts:** tenants are invited by email and see only their own tenancy.
- [V1] **Contractor job links:** contractors don't need an account; each job gets a secure link (hashed, expiring) to view and update that one job.
- [V1] One person can belong to several workspaces.
- [Later] Landlord-owner portal (for agents managing other people's properties).

## 2. Properties
- [V1] Add a property: address (UK format, postcode), type (house, flat, HMO, bungalow, other), bedrooms, bathrooms, furnished status, photos, notes.
- [V1] Units inside a property (e.g. flats in a block, rooms in an HMO). A simple property is one unit.
- [V1] Property page: current tenancy, rent status, open repairs, documents and certificates, activity timeline.
- [V1] Property status: occupied, vacant, ending soon (calculated).
- [V1] Search and filter by address, postcode, status.
- [V1+] Property owner contact record (for agents), shown on the property.
- [Later] Public listings and vacancy adverts.

## 3. Tenants
- [V1] Tenant records: name, email, phone, date of birth (optional), emergency contact, notes.
- [V1] Right to Rent check record (England): date checked, method, expiry date for time-limited permission, with a reminder before the follow-up check is due. Evidence files stored as documents.
- [V1] Invite a tenant to their portal; see invite status.
- [V1] Tenant page: tenancies (current and past), rent history, documents, repairs, messages.
- [V1] Guarantor details per tenancy (name, contact, notes, documents).

## 4. Tenancies
- [V1] Create a tenancy with a step-by-step form: unit, one or more tenants (joint tenancy), start date, end date or rolling (periodic), rent amount, rent frequency (monthly, weekly, four-weekly), due day, deposit.
- [V1] Tenancy statuses: upcoming, active, ending (notice given), ended (calculated from dates and notice).
- [V1] Record notice given (who, date, end date) and end a tenancy.
- [V1] Rent changes with an effective date and full history; future rent charges use the new amount from that date.
- [V1] Tenancy page: summary, rent ledger, deposit, documents, repairs, messages, timeline.
- [V1+] Renewal: create the next tenancy from an existing one in one click.
- [Later] Applicant tracking and referencing.

## 5. Rent tracking (no payment processing)
- [V1] Rent charges generated automatically from the tenancy (frequency, due day, rent changes), shown as a ledger.
- [V1] Record payments manually: date, amount, method (bank transfer, standing order, cash, card, other), reference. Part-payments and overpayments allowed; payments are allocated to the oldest unpaid charges.
- [V1] Running balance per tenancy; arrears with days overdue.
- [V1] Other charges: one-off charges and credits with a description (e.g. replacement keys).
- [V1] Arrears list across the portfolio, sorted by amount and age.
- [V1] Automatic emails to tenants: friendly reminder before rent is due (configurable, default 3 days) and overdue reminders (configurable, default 3, 7 and 14 days late). Stops when paid. Can be switched off per tenancy.
- [V1] Rent receipt or statement PDF for a tenant for any date range.
- [V1] Tenants see their own ledger and balance in the portal.
- [V1] All money stored as integer pence, GBP.
- [Later] Online payments, open-banking matching, bank statement import.

## 6. Deposits
- [V1] Deposit amount, date received, scheme (DPS, TDS, mydeposits or other), scheme reference, date protected, date prescribed information was given.
- [V1] Reminder if a deposit is not marked as protected within a set number of days of receipt (configurable, default 30).
- [V1] Deposit return record at the end of a tenancy: amount returned, deductions with reasons, date.

## 7. Maintenance and repairs
- [V1] Tenants report a repair from the portal: category (heating, plumbing, electrical, damp and mould, appliances, security, other), description, photos, access notes and availability.
- [V1] Staff can also log repairs themselves.
- [V1] Priority: emergency, urgent, routine, with target response times per priority set in settings.
- [V1] Status flow: reported → acknowledged → scheduled → in progress → completed → closed (or cancelled), with a timeline of every change.
- [V1] Assign a contractor from the contractor directory; the contractor gets an email with their secure job link.
- [V1] Contractor job page (no account): job details, access notes, tenant contact (only if the workspace allows it), update status, add a visit date, add photos and notes, enter the cost.
- [V1] Comments on each repair, visible to the tenant or internal-only (staff choose).
- [V1] Tenants get email updates on status changes and see progress in the portal.
- [V1] Overdue repairs (past the target time) highlighted on the dashboard.
- [V1] Repair costs recorded per property for reports.
- [V1] Contractor directory: name, company, trade, email, phone, notes.

## 8. Documents and compliance
- [V1] Upload documents to a property, tenancy or tenant: PDF, JPEG, PNG, HEIC (converted), size-limited, stored privately, downloaded only through permission checks.
- [V1] Document types with optional expiry dates: tenancy agreement, gas safety certificate, electrical safety certificate (EICR), EPC, deposit certificate, prescribed information, How to Rent guide (England), Right to Rent evidence, smoke and CO alarm check, licence (HMO or selective), insurance, inventory, other.
- [V1] **Compliance board:** every property with the status of each certificate — valid, expiring soon, expired, missing — colour-coded.
- [V1] Expiry reminders to staff at 60, 30 and 7 days (configurable).
- [V1] Share chosen documents with the tenant; the tenant sees them in the portal.
- [V1] A clear note in the app: reminders are a helpful tool, not legal advice; landlords remain responsible for their legal duties.

## 9. Inspections and inventories
- [V1+] Schedule property inspections with a date and reminder.
- [V1+] Inspection report: room-by-room checklist with condition, notes and photos; export as PDF.
- [V1+] Check-in and check-out inventories in the same format, with a side-by-side comparison at check-out.

## 10. Messages and notes
- [V1] A message thread per tenancy between staff and tenants, with email notifications.
- [V1] Internal notes on properties, tenancies and tenants (never shown to tenants).
- [V1] Activity timeline on every record (who did what and when).

## 11. Dashboard and calendar
- [V1] Stat cards: rent due this week, overdue rent (total and count), open repairs (and overdue), certificates expiring or expired, tenancies ending in the next 60 days, vacant units.
- [V1] "Needs attention" list combining the most urgent items.
- [V1] Recent activity feed.
- [V1] Calendar (month and list view): rent due dates, repair visits, certificate expiries, tenancy start and end dates, inspections.

## 12. Reports and exports
- [V1] Rent roll: every tenancy with rent, frequency, balance.
- [V1] Income report: rent received per month, per property, for a chosen date range.
- [V1] Arrears report.
- [V1] Maintenance costs per property.
- [V1] CSV export of every report; PDF for statements.
- [V1] Full workspace data export (all records as CSV + documents as a zip) for portability.

## 13. Tenant portal (mobile-first)
- [V1] Home: current rent and next due date, balance, open repairs, latest messages.
- [V1] Rent history and statement download.
- [V1] Report a repair (with phone camera upload) and follow its progress.
- [V1] Shared documents.
- [V1] Messages with the landlord or agent.
- [V1] Update own contact details (phone, emergency contact).

## 14. Settings
- [V1] Workspace name, logo and contact details (used in tenant emails and PDFs).
- [V1] Reminder schedules (rent, overdue, certificates, deposit protection).
- [V1] Repair priorities and target times; whether contractors see tenant contact details.
- [V1] Email settings for self-hosters (SMTP via env).
- [V1] Data retention: archive ended tenancies; anonymise tenant personal data a configurable number of years after the tenancy ends (financial totals kept).
- [V1] Delete workspace (Owner only, with confirmation).

## 15. Security and privacy
- [V1] Deny-by-default API, role checks, every query scoped to the workspace; tenants scoped to their own tenancies; contractor links scoped to one job.
- [V1] Audit log of sensitive actions (logins, exports, deletions, role changes, document downloads), append-only.
- [V1] Rate limits on login, codes, invites and public links.
- [V1] Files private, served only through the API after permission checks; photo metadata (including GPS) stripped.
- [V1] No real personal data in seeds, tests or logs.

## 16. Demo mode, landing page and self-hosting
- [V1] Landing page: what it is, who it's for, feature tour with screenshots, "Try the live demo", "View on GitHub", self-hosting command.
- [V1] Demo mode: realistic fake portfolio (about 8 properties in West Yorkshire, fake tenants, rent history with some arrears, open repairs, certificates in every state), one-click "Try as landlord" and "Try as tenant", emails captured in a demo mail viewer, uploads size-limited and purged hourly, nightly reset, sign-up off.
- [V1] `docker compose up` for self-hosting (web, API, worker, PostgreSQL, Redis).
- [V1] README with screenshots, features, self-hosting guide, architecture, decisions and tests.
