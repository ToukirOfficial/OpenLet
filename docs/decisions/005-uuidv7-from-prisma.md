# 005: UUIDv7 ids made by Prisma, not the database

**Date:** 2 November 2026

The first schema used PostgreSQL 18's built-in `uuidv7()` as the column default. The demo server runs PostgreSQL 16, which doesn't have it, so the first migration failed there. Ids are now made by Prisma (`@default(uuid(7))`), as in the owner's other projects. They are still time-ordered UUIDv7 values, and OpenLet now runs on PostgreSQL 16 and later.

No real data existed anywhere yet, so the migration history was regenerated as one clean `init` migration.
