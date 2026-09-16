---
name: moterom-verification-and-delivery
description: Run Møterom required checks and write an honest completion report before finishing a task or opening a pull request. Use at the end of implementation work.
---

# Møterom verification and delivery

Finish with evidence, not claims.

## Required inputs

- The branch and the intended base (`dev` for features)
- Commands in `package.json`: `check`, `format:check`
- `docs/acceptance.md` for what is still outstanding
- Browser tools when a UI change needs them

## Procedure

1. Run `npm run check` and `npm run format:check` on Node 24.
2. Add focused regression coverage for verified defects.
3. Manually exercise changed customer and admin journeys when a browser is available. Inspect the console and failed requests.
4. Confirm persistence and permission boundaries for writes you touched.
5. Separate local demo, mocked, staging, and production evidence.
6. Update docs that would otherwise be wrong.
7. Open a reviewable PR into `dev`. Do not merge or deploy unless the user asked.

## Non-negotiable

- Never claim a test ran when it did not
- Never claim WCAG, staging, or production readiness from local demo alone
- Record remaining blockers and launch prerequisites

## Acceptance

- Required commands passed, or failures are listed with cause
- PR describes what changed, what was verified, and what was not
- Launch blockers stay visible in `docs/acceptance.md` when they still apply

## Evidence

Use this report shape:

- Implemented
- Defects fixed
- Images (actual vs illustrative)
- Checks run and environment
- Remaining blockers
- Branch and PR link
