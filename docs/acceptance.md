# Acceptance record

## Automated locally

Run `npm run check` and `npm run format:check` on Node 24. The suite covers:

- Oslo UTC offsets; nonexistent and ambiguous DST times; adjacent and overlapping intervals.
- One booking for repeated idempotent submissions; changed-body rejection; capacity, ownership and admin access.
- Maintenance blocks and cancellation releasing availability; edit requests preserving original reservations.
- HTTP authentication, Origin enforcement, HttpOnly cookie, signed quote binding, booking creation/retry, ICS export and cancellation.
- Administrator approve, reject, block create/delete, and room PATCH, including customer 403s.
- Digilist approval configuration, cross-tenant rejection, failure-versus-unavailability and preserving existing room rules when editing.
- Dashboard-to-listing URL mapping for hosted payment handoff.

## Manual browser — this quality pass (local demo, Chromium in Cursor)

Verified on 16 September 2026 against `http://localhost:4173` in demo mode:

1. Date-first search for 17 Sep 2026 09:00–10:00 showed 6 available rooms and hid occupied Tysso, with error vs occupied still distinct.
2. Room-first path preserved the interval into Sauda 1 detail and checkout (`Bekreft booking · Møterom`). Confirmation banner after submit: “Bookingen er bekreftet”.
3. Illustrative WebP images loaded (`naturalWidth` 1600) and showed **Illustrasjonsfoto**.
4. Admin overview used “Rom uten aktivitet nå”. Week view prev/next were “Forrige uke” / “Neste uke”. Dark theme toggled. Mobile nav labelled Administrasjon.
5. Viewports 360, 390, 768, 1024, 1440: `documentElement.scrollWidth` did not exceed the viewport on the booking detail and admin overview (including 360px admin).

Not claimed: VoiceOver/NVDA, Safari/Firefox, 200% zoom measurement, physical device keyboard, live Digilist, or production.

## Manual browser acceptance — still outstanding for launch

Before launch, review the built app in desktop and mobile browsers outside this agent session:

1. Keyboard-only room selection, login, calendar, modal, confirmation and cancellation. Check visible focus, label announcements, status messages and dialog focus return on a physical keyboard.
2. Floor-plan readability when `FLOORPLAN_PATH` is set; replace illustrative photos with approved building photographs when available.
3. Filter with zero results, delayed availability, API failure, stale slot, stale price and expired login.
4. Double-click confirmation and retry after a lost response on an unreliable network.

## Customer tenant acceptance — outstanding

Use a dedicated staging tenant. Confirm the deployment matches the reviewed API contracts, then run free direct booking, approval-required booking, rejection, cancellation, edit request and admin blocking with two distinct users. Repeat a simultaneous booking attempt from separate sessions: exactly one can reserve the same room/time. Verify opening hours and buffer rules in Oslo winter and summer, plus membership revocation and cross-tenant denial.

Agree on paid-booking behavior before enabling it. Confirm actual invoice/email/calendar behavior in Digilist rather than relying on demo presentation. Verify that contact details, accessibility information, both Eidefossen room names, capacities and photographs match the building.

Do not merge/deploy as a customer-ready release until these outstanding checks and configuration decisions are resolved. This is a reviewable implementation with a working isolated demo.
