---
name: moterom-booking-integrity
description: Keep Møterom availability, pricing, booking, cancellation, approval, calendar export, and blocking aligned with Digilist contracts and Oslo time. Use when those flows change.
---

# Møterom booking integrity

Digilist (live) or the demo store (local only) is the write authority. The portal must not invent a second booking engine.

## Required inputs

- Interval handling in `shared/time.ts` (`Europe/Oslo`)
- Quote and booking handlers in `server/app.ts`
- Provider methods in `server/demo.ts` or `server/digilist.ts`
- Existing tests in `tests/`
- `docs/digilist-integration.md` for upstream limits

## Procedure

1. Use server rules for availability of the entire requested interval, capacity, blocks, and identity.
2. Keep tenant and ownership checks on every relevant read and mutation.
3. Handle invalid, past, reversed, nonexistent, and ambiguous Oslo times with a clear error.
4. Preserve idempotency keys across uncertain retries; do not mint a new key for the same attempt.
5. Distinguish request, confirmation, cancellation, and payment in copy and status.
6. Keep the original reservation intact while a change request is pending.
7. Add a targeted regression test when the defect is in booking, quotes, approval, or blocking.
8. Document upstream limits (hosted payment handoff, invoice-not-issued) instead of concealing them.

## Non-negotiable

- Pending is not confirmed
- Hosted payment is not an in-app charge
- Do not mix demo data into live results
- Do not modify production Digilist records while testing

## Acceptance

- Availability errors are not labelled as occupied rooms
- A retry cannot create a duplicate reservation
- Calendar export matches the authorized booking times
- Admin approve/reject/block changes the intended record

## Evidence

Name the tests you ran and whether they were demo HTTP, unit, or live staging. Never claim a concurrent-booking test that was not executed.
