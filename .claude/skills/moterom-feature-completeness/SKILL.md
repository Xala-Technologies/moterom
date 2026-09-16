---
name: moterom-feature-completeness
description: Trace Møterom UI actions through request, authorization, provider, persistence, and the resulting screen. Use when adding, changing, or repairing an interactive feature.
---

# Møterom feature completeness

A control is finished only when the full path works, including failure.

## Required inputs

- The user action and the route that hosts it
- Client call in `src/` (`src/api.ts` or page fetch)
- Matching Express handler in `server/app.ts`
- Demo and/or Digilist provider methods
- Permission and empty/loading/error UI already used in the app

## Procedure

1. Trace UI → request → authorization → provider → persistence → visible result.
2. Cover loading, success, failure, retry, empty, and permission-denied states.
3. Confirm a saved result survives refresh when persistence is expected.
4. Preserve user input during recoverable failures.
5. Prevent double submission and applying a stale response after the user changed filters.
6. Never invent a placeholder success.

## Non-negotiable

- Do not hide a broken control to make the feature look complete
- Do not weaken a permission check to make the action succeed
- Demo login exists only in demo mode

## Acceptance

- The action reaches the intended destination and respects current booking or admin state
- Failure copy is recoverable (retry, sign-in, or a real restriction)
- Repeated clicks cannot silently create a second write

## Evidence

Record the path you traced, whether you refreshed after save, and which failure states you actually triggered.
