# OpenLet

[![CI](https://github.com/ToukirOfficial/OpenLet/actions/workflows/ci.yml/badge.svg)](https://github.com/ToukirOfficial/OpenLet/actions/workflows/ci.yml)
[![Licence: AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0-135e4b.svg)](LICENSE)

**Free, open-source property and tenancy management for small landlords and small letting agents.** Properties, tenants, rent, repairs, documents and certificates in one place, with a portal for your tenants and a job page for your contractors.

Self-hosted: install it on your own server with one command, keep your own data, pay nothing.

**[Try the live demo](https://openlet.toukirahmedrony.com/demo)**: one click as the landlord or as a tenant. It's a made-up agency with eight properties in West Yorkshire, and it resets every night.

> Screenshots: the live demo is the best tour. (Screenshot images for this README are still to be added.)

## Contents

- [What it does](#what-it-does)
- [Who it's for](#who-its-for)
- [Self-host with Docker](#self-host-with-docker)
  - [First login](#first-login)
  - [Backups](#backups)
  - [Upgrading](#upgrading)
- [Running it locally (development)](#running-it-locally-development)
- [Deploying to a server without Docker](#deploying-to-a-server-without-docker)
- [Architecture](#architecture)
- [Hard problems and decisions](#hard-problems-and-decisions)
- [Tests](#tests)
- [Contributing](#contributing)
- [Licence](#licence)

## What it does

| | |
|---|---|
| **Properties** | Houses, flats and HMOs, split into units (flats in a block, rooms in an HMO). Search by address or postcode; status (occupied, vacant, ending soon) is worked out from the tenancies. |
| **Tenants** | Contact details, emergency contact, Right to Rent checks with follow-up reminders, and an invite to their own portal. |
| **Tenancies** | A step-by-step form: unit, joint tenants, dates or rolling, rent (monthly, weekly or every four weeks), due day, deposit. Rent changes, notice, ending, guarantors, deposit protection and return. |
| **Rent** | Charges appear by themselves. Record payments (part or over), one-off charges and credits; mistakes are reversed, never edited. Arrears by amount and age, reminder emails before and after the due date, and PDF statements. |
| **Repairs** | Tenants report with phone photos; you set the priority and assign a contractor, who gets a secure link to book a visit, add photos, mark it done and enter the cost. Everyone is kept up to date by email. |
| **Compliance** | A board of every property's gas safety, EICR, EPC, smoke and CO alarm, licence and insurance: valid, expiring, expired or missing, with reminders at 60, 30 and 7 days. |
| **Tenant portal** | Phone-first: balance and next rent, report a repair, follow its progress, shared documents, messages, statement download. |
| **Dashboard and reports** | Stat cards, a "needs attention" list, a calendar, rent roll, income, arrears and maintenance costs, CSV downloads and a full data export. |
| **Team** | Owner, Manager and Staff roles, team invites, an audit log, several workspaces per person. |

Reminders are a helpful aid, not legal advice. Landlords remain responsible for their legal duties.

## Who it's for

- **Landlords** with one to a handful of properties.
- **Small letting agencies** with up to about 50 properties and a small team.
- **Self-hosters**: a developer or technical friend installing it for a landlord or agency.

## Self-host with Docker

You need a server with Docker (2 GB of memory is plenty).

```bash
git clone https://github.com/ToukirOfficial/OpenLet.git
cd OpenLet
./scripts/init-env.sh      # writes .env with fresh random secrets
```

Then edit `.env`:

- `APP_URL`: the address people will use, e.g. `https://lettings.example.com`.
- Email: set `MAIL_TRANSPORT=smtp` and the `SMTP_*` settings for your provider (any SMTP service works). With `MAIL_TRANSPORT=log`, emails are only written to the worker log.

Every other setting is described in [`.env.example`](.env.example).

Then:

```bash
docker compose up -d
```

This starts the web app, API, worker, PostgreSQL and Redis. The API applies database migrations when it starts. Put it behind HTTPS (for example Caddy or nginx with Let's Encrypt) pointing at port 8030.

### First login

Open your site. The first visitor sees a setup screen that creates the **Owner** account and the workspace. After that the setup screen is closed for good. Invite the rest of your team from **Settings → Team**, and your tenants from their page or tenancy.

Sign-up for new workspaces is off. Set `SIGNUP_ENABLED=true` only if you want to run OpenLet as a service for other businesses.

### Backups

Everything worth keeping is in two places:

```bash
# Database
docker compose exec postgres pg_dump -U openlet openlet | gzip > openlet-$(date +%F).sql.gz
# Uploaded documents and photos
docker run --rm -v openlet_storage:/data -v "$PWD":/backup alpine tar czf /backup/openlet-files-$(date +%F).tgz -C /data .
```

Owners can also download everything as CSV and files from **Reports → Export everything**.

### Upgrading

```bash
git pull
docker compose up -d --build
```

Migrations run automatically. Take a database backup first.

## Running it locally (development)

Needs Node 24, pnpm 10, PostgreSQL 18 and Redis.

```bash
pnpm install
cp .env.example .env            # set JWT_SECRET; COOKIE_SECURE=false for http://localhost
pnpm db:migrate                 # creates the tables
pnpm build && pnpm db:seed      # fake demo data and logins (see ASSUMPTIONS.md)
pnpm dev                        # web on :8030, API on :8130, worker
```

The seed only runs with `DEMO_MODE=true` (or `pnpm --filter @openlet/api db:seed -- --dev` on a development machine), and the seeded logins only work while `DEMO_MODE=true`, because their password is published.

## Deploying to a server without Docker

`deploy.sh` builds everything locally and uploads a release to a server running PM2 behind nginx. Server details live only in `deploy.env`, which is git-ignored: copy [`deploy.env.example`](deploy.env.example) and fill in the SSH alias, folders, site address and ports. The script checks the ports are free on the server before it starts, backs up the database before running new migrations, and switches back to the previous release if the health check fails.

## Architecture

```
apps/web         Next.js (App Router): landing page, staff app, tenant portal, contractor job page. Display only.
apps/api         NestJS + Prisma: every rule, permission and query. Also the BullMQ worker (dist/worker.js).
packages/shared  Zod schemas and types shared by both, plus pure rules (dates, money, statuses).
```

- The browser only talks to the web server; it forwards `/api/*` to NestJS, so cookies are first-party.
- **NestJS decides everything.** A global guard denies every route unless it is marked public, for signed-in users, for tenants, or for specific roles.
- **Slow work runs on queues** (emails, rent charges, PDFs, CSVs, exports, photo conversion, reminders, retention) in the worker, with scheduled jobs in London time.
- PostgreSQL 18 (UUIDv7 ids), Redis for queues, rate limits and the dashboard cache.

## Hard problems and decisions

- **The rent ledger is append-only.** Charges, payments, credits and reversals are rows that are never changed. A mistake is fixed with a reversal plus a new entry, so the history always adds up. Money is integer pence.
- **Rent charges come from a pure schedule.** A tenancy's start date, due day, frequency, rent history and end date give the same periods every time. A unique key on (tenancy, period start) makes the daily job idempotent: running it twice never charges twice. Monthly rent due on the 29th–31st falls back to the month's last day; weekly and four-weekly count from the start date; nothing is charged after the last day.
- **Payments are allocated oldest first**, worked out from the ledger each time rather than stored, so a reversal can never leave allocations out of step. Overpayments are credit.
- **Tenant isolation.** Every portal query starts from the tenant's own tenancies; any other id simply doesn't exist for them. Internal notes, internal repair comments, contractor names and costs are never returned.
- **Contractor links.** A random token is emailed; only its SHA-256 hash is stored. It opens exactly one repair, stops working when the repair is closed (plus a grace period) or reassigned, and can be withdrawn.
- **Reminders are sent at most once.** Each reminder is claimed in a table with a unique key (kind, item, step) before sending; it stops when the reason is gone (paid, renewed, protected).
- **Privacy.** Files are stored privately under random names, photo metadata (including GPS) is stripped, downloads go through permission checks and are audited, and former tenants are anonymised after a set number of years while the money stays.

More detail in [`docs/decisions/`](docs/decisions/), [`plan.md`](plan.md) and [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

## Tests

```bash
pnpm test
```

The API tests run against real PostgreSQL and Redis (a separate `_test` database). They cover login and refresh tokens, every role and workspace-isolation rule, tenant isolation, contractor link scope and expiry, rent charge generation (monthly including the 29th–31st, weekly, four-weekly, rent changes, end dates, idempotency), payment allocation and balances, reminder scheduling, compliance status and retention anonymisation.

## Contributing

This repository is public. A pre-commit hook (`.githooks`, switched on by `pnpm install`) runs [`scripts/scan-secrets.sh`](scripts/scan-secrets.sh) on staged changes and stops any commit containing keys, passwords, IP addresses or values from your `deploy.env`. Run `pnpm scan` to check the whole repository.

## Licence

[AGPL-3.0](LICENSE). If you run a modified version as a service, you must share your changes.
