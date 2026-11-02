# 003: An append-only ledger with allocation worked out on read

**Date:** 2 November 2026

Rent money is the part of OpenLet that must never be wrong. Ledger rows (charges, payments, credits, reversals) are only ever inserted. A mistake is corrected by a reversal that cancels the original, plus a new entry. Nothing is updated or deleted, so the history always adds up and can be audited.

Which charges a payment paid is not stored. It is worked out each time from the ledger (oldest unpaid charge first), which is cheap for a small portfolio and means a reversal can never leave stale allocations behind.

Rent charges come from a pure schedule function. A unique key on (tenancy, type, period start) makes the daily job idempotent.
