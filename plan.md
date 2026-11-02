# OpenLet — Build plan

Stack per the project rules: Next.js 16.4.4 (16.3.x has critical advisories; approved, see docs/decisions/001) · NestJS 12.3.2 · Node 24 · PostgreSQL 18 + Prisma 7 · Redis + BullMQ · Zod in `packages/shared` · pnpm + Turborepo. Every [V1] item in FEATURES.md is covered below; [V1+] is Phase 11 and optional.

**Local:** web **8030**, API **8130**, Postgres db `openlet`, Redis db **14** with prefix `openlet:`. 8030/8130 are free in `~/projects/PORTS.md` and on this machine; OpenLet is now listed there.

## Decisions (open questions resolved at "Go", 2 Nov 2026)
1. **Email code** only on a new device; a trusted-device cookie lasts 30 days. Demo accounts skip it.
2. **Redis db 14** (db 8 is used by lifeos locally), key prefix `openlet:`; tests use prefix `openlet-test:` and never flush a whole db.
3. **Libraries** as listed: argon2, nodemailer, sharp, heic-convert, file-type, pdfkit, archiver, csv-stringify, date-fns + @date-fns/tz, bullmq + ioredis, pg + Prisma adapter; web: shadcn/ui (radix-ui, cva, clsx, tailwind-merge, sonner, tw-animate-css), lucide-react, recharts. Dropped to keep it lean: @nestjs/throttler (Redis rate limiter instead), cookie-parser (tiny parser), react-query and react-hook-form (small `useApi` hook and plain forms with the shared Zod schemas).
4. **Deploy:** I write `deploy.sh` and the notes below; you run it.
5. **Run commands** are for WSL.

## Data model (Prisma; UUIDv7 via Postgres 18 `uuidv7()`, `createdAt`/`updatedAt` everywhere)
- **Access:** `User` · `RefreshToken` (family, hash, rotatedAt, revokedAt) · `AuthCode` (login/reset, hash, attempts, expiry) · `TrustedDevice` · `InstallState` (setup done) · `Workspace` + `WorkspaceSettings` (reminders, priorities and targets, retention years, required docs, contractor-sees-tenant) · `Membership` (user, workspace, OWNER/MANAGER/STAFF) · `Invite` (team or tenant, token hash, expiry).
- **Portfolio:** `Property` (UK address, postcode, type, beds, baths, furnished, hasGas) · `Unit` · `Tenant` (optional `userId`, contact, DOB, emergency contact, `anonymisedAt`) · `RightToRentCheck` · `Contractor`.
- **Tenancy:** `Tenancy` (unit, start, end or periodic, frequency, due day, reminders on/off, notice fields, endedOn, archivedAt) · `TenancyTenant` (joint) · `Guarantor` · `RentChange` (amount pence, effectiveFrom) · `Deposit` · `DepositReturn` + `DepositDeduction`.
- **Money:** `LedgerEntry`, append-only: RENT_CHARGE / OTHER_CHARGE / PAYMENT / CREDIT / REVERSAL, pence, due date, period, method, reference, `reversesId`; unique (tenancyId, periodStart) for rent charges. FIFO allocation is worked out from the ledger, never stored as editable rows.
- **Work:** `Repair` (property/unit/tenancy, category, priority, status, targetAt, visitAt, contractor, cost) · `RepairEvent` (status change or comment, TENANT/INTERNAL visibility, actor type) · `ContractorLink` (repair, token hash, expiresAt, revokedAt).
- **Files and comms:** `Document` (property/tenancy/tenant/repair, type, expiresOn, sharedWithTenant, random storage key, mime, size) · `Message` (tenancy thread) · `Note` (internal) · `Activity` (timeline/feed) · `AuditLog` (append-only) · `ReminderSent` (unique kind+item+step) · `OutboundEmail` (demo mail viewer) · `ExportJob`.

## NestJS modules
Auth · Setup · Workspaces (members, invites, settings) · Properties (+units) · Tenants (+Right to Rent) · Tenancies (+rent changes, notice, guarantors, deposits) · Ledger (charges, payments, arrears, statements) · Repairs (+contractors, contractor links) · Documents (uploads, compliance) · Messages & Notes · Activity & Audit · Dashboard & Calendar · Reports & Exports · Portal (tenant API) · ContractorJob (public, link-scoped) · Mail · Jobs (BullMQ schedulers + processors; `worker.ts` entry) · Retention · Demo.

## API endpoints (`/api/v1`; O=Owner M=Manager S=Staff T=Tenant C=contractor link; P=public)
| Area | Endpoints | Access |
|---|---|---|
| Setup / auth | `GET/POST /setup` (only before setup) · `POST /auth/signup` (if SIGNUP_ENABLED) · `/auth/login`, `/auth/verify-code`, `/auth/refresh`, `/auth/logout`, `/auth/reset/request`, `/auth/reset/confirm`, `/invites/:token/accept` · `GET /me` | P (rate-limited) · `/me` all users |
| Workspaces | `GET/POST /workspaces` · `PATCH /workspaces/:id/settings` · `DELETE /workspaces/:id` | list all · create O · settings O M · delete O |
| Team | `GET/POST/PATCH/DELETE /members`, `/invites` | O |
| Properties, units | CRUD `/properties`, `/properties/:id/units`; search/filter by address, postcode, status | O M S (delete O M) |
| Tenants | CRUD `/tenants`, `/tenants/:id/right-to-rent`, `POST /tenants/:id/invite` | O M S |
| Tenancies | CRUD `/tenancies`, `/tenancies/:id/rent-changes`, `/notice`, `/end`, `/guarantors`, `/deposit`, `/deposit/return` | O M S |
| Ledger | `GET /tenancies/:id/ledger` · `POST /payments`, `/charges`, `/credits`, `/entries/:id/reverse` · `GET /arrears` · `POST /tenancies/:id/statements` (PDF job) | O M S |
| Repairs | CRUD `/repairs`, `POST /repairs/:id/status`, `/comments`, `/assign`, `/links/revoke` · CRUD `/contractors` | O M S |
| Documents | `POST /documents` (upload) · `GET /documents/:id/download` · `PATCH` share/expiry · `GET /compliance` | O M S; download also T if shared |
| Messages, notes, activity | `/tenancies/:id/messages` · CRUD `/notes` · `GET /activity` · `GET /audit-log` | messages O M S T(own) · notes, activity O M S · audit O |
| Dashboard, calendar | `GET /dashboard`, `GET /calendar?from&to` | O M S |
| Reports, export | `GET /reports/rent-roll`, `/income`, `/arrears`, `/maintenance` (`?format=csv`) · `POST /exports` (zip job) | O M (Staff: no exports) · full export O |
| Portal | `GET /portal/home`, `/portal/ledger`, `POST /portal/statements`, `GET/POST /portal/repairs`, `/portal/documents`, `/portal/messages`, `PATCH /portal/contact` | T (own tenancies only) |
| Contractor job | `GET /job/:token` · `POST /job/:token/status`, `/visit`, `/photos`, `/notes`, `/cost` | C (one repair, unexpired) |
| Demo | `POST /demo/login/:as` · `GET /demo/mail` | P only when DEMO_MODE |

## Pages (Next.js; all data from the API)
- **Public:** `/` landing · `/setup` · `/login`, `/verify`, `/reset`, `/invite/[token]` · `/job/[token]` contractor page · `/demo/mail` (demo only).
- **Staff app `/app`** (O M S unless noted): dashboard · properties list + page (tabs: overview, units, rent, repairs, documents, timeline) · tenants list + page · tenancies list + new-tenancy wizard + page (summary, ledger, deposit, documents, repairs, messages, timeline) · arrears · repairs board + page · contractors · compliance board · calendar (month/list) · messages inbox · reports (O M) · settings (O M; team, audit log and delete workspace O only) · workspace switcher.
- **Tenant portal `/portal`** (T): home · rent and statements · repairs + report-a-repair · documents · messages · my details.

## Phases (each a working end-to-end slice)
**Phase 1 — Foundation, access and design** ✅ done
1. Monorepo, Prisma, Zod pipe, global deny-by-default guard, `@Public()`, rate limits; local Postgres/Redis/Mailpit; CI (typecheck, lint, test, build).
2. Design system: Tailwind theme tokens (palette with status colours, type scale, spacing, radius), self-hosted font, OpenLet SVG wordmark, shadcn themed, app shell and portal shell, skeletons and empty states.
3. First-run setup, login + email code, rotating refresh cookies, password reset, `/me`, audit log of logins; tests.
4. Workspaces, memberships, roles guard, team invites, workspace switcher, tenant role and contractor-link token service (hash, scope, expiry, revoke); isolation tests.

**Phase 2 — Properties and tenants** ✅ done
1. Properties and units: create/edit, UK address and postcode check, calculated status, search and filter.
2. Tenants with Right to Rent record; contractor directory.
3. Private uploads: content-type sniffing, size limit, metadata/GPS strip, HEIC→JPEG on queue, permission-checked download, audit on download.
4. Internal notes and activity timeline on every record.

**Phase 3 — Tenancies and deposits**
1. New-tenancy wizard (unit, joint tenants, dates or periodic, rent, frequency, due day, deposit); calculated statuses.
2. Rent changes with history; notice and end tenancy; guarantors with documents.
3. Deposit record, protection details and return with deductions.
4. Invite tenant to portal, invite status, tenant login lands in `/portal`; tenant-isolation tests.

**Phase 4 — Rent ledger**
1. Daily charge job (monthly with 29th–31st, weekly, four-weekly, rent changes, end dates, idempotent); tests.
2. Payments, other charges, credits and reversals; FIFO allocation, running balance, days overdue; tests.
3. Ledger tab and portfolio arrears list (by amount and age).
4. Statement/receipt PDF for any date range (queued).

**Phase 5 — Repairs and contractors**
1. Staff-logged repairs, priorities with target times, status flow with timeline, overdue flag.
2. Comments (tenant-visible or internal), assign contractor, contractor email with link.
3. Contractor job page: details, access notes, tenant contact if allowed, status, visit date, photos, notes, cost; link scope/expiry tests.
4. Tenant emails on each status change; repair costs per property.

**Phase 6 — Compliance and reminders**
1. Document types with expiry, share with tenant; compliance board (valid/expiring/expired/missing, required-doc settings); status tests.
2. Reminder engine: rent due, overdue steps, certificate 60/30/7, deposit protection, Right to Rent; once per item and step, stops when resolved; tests.
3. Settings for reminder schedules, per-tenancy switch-off, "not legal advice" note across the app.

**Phase 7 — Tenant portal and messages**
1. Portal home (rent, next due, balance, open repairs, latest messages), rent history and statement download.
2. Report a repair with phone camera upload and follow progress; shared documents.
3. Message threads per tenancy (staff inbox and portal) with email notifications; update own contact details.

**Phase 8 — Dashboard, calendar and reports**
1. Dashboard stat cards, "needs attention", activity feed (Redis-cached, under 1 s).
2. Calendar month and list view: rent due, visits, expiries, tenancy start/end.
3. Rent roll, income, arrears and maintenance reports with CSV (queued).
4. Full workspace export (CSV + documents zip, queued, Owner, audited).

**Phase 9 — Settings and retention**
1. Workspace name, logo, contact details used in emails and PDFs; priority targets; contractor-contact toggle.
2. Archive ended tenancies; anonymise tenant data N years after end, keeping financial totals; tests.
3. Delete workspace (Owner, typed confirmation); extra workspaces; `SIGNUP_ENABLED`.

**Phase 10 — Self-hosting, demo and landing page**
1. Dockerfiles + `docker-compose.yml` (web, api, worker, postgres, redis), `.env.example`, clean-machine run.
2. Demo mode: West Yorkshire fake portfolio seed, one-click landlord/tenant, demo contractor link, mail viewer, 2 MB uploads purged hourly, nightly reset.
3. Landing page at `/` with screenshots/tour, five journeys, FAQ, demo and GitHub buttons.
4. README (screenshots, self-hosting, architecture, decisions, tests), `deploy.sh`; walk all 5 journeys on desktop and phone.

**Phase 11 — [V1+] optional (only once every [V1] check passes)**
1. Property owner contact record for agents.
2. One-click tenancy renewal.
3. Inspections with date and reminder; room-by-room report with photos and PDF (added to calendar).
4. Check-in/check-out inventories with side-by-side comparison.

## Deploy notes (for you; I don't deploy)
- **Processes:** web (Next standalone), api (Nest), **worker** (`node dist/worker.js`, same image as the API). All three must run; nothing time-based happens without the worker.
- **Scheduled jobs (BullMQ job schedulers, Europe/London):** rent charges daily 02:00 · reminders daily 08:00 · compliance status daily 06:00 · retention anonymisation daily 03:30 · demo reset nightly 03:00 and demo upload purge hourly (demo only).
- **Uploads:** `STORAGE_DIR` outside any public folder, on a persistent disk/volume, included in backups; nginx `client_max_body_size` ≥ 15M.
- **Same origin:** serve the API under `/api` on the same domain as the web app so `SameSite` cookies work; HTTPS required (`Secure` cookies).
- **Env:** `DATABASE_URL`, `REDIS_URL` (+db), `JWT_*` secrets, `SMTP_*`, `APP_URL`, `SIGNUP_ENABLED=false`, `DEMO_MODE` (true on the demo site), `CONTRACTOR_LINK_GRACE_DAYS`, `UPLOAD_MAX_MB`.
- **Migrations:** `prisma migrate deploy` on each release; dump the DB first. Native deps: sharp (bundled libvips), argon2.
- **Live ports suggestion:** web 3031 / API 4131 (next free after slotwise 3030/4130); check on the VPS first.
