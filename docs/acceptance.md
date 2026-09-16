# Acceptance record

## Automated locally

Run `npm run check` and `npm run format:check` on Node 24. The suite covers:

- Oslo UTC offsets; nonexistent and ambiguous DST times; adjacent and overlapping intervals.
- One booking for repeated idempotent submissions; changed-body rejection; capacity, ownership and admin access.
- Maintenance blocks and cancellation releasing availability; edit requests preserving original reservations.
- HTTP authentication, Origin enforcement, HttpOnly cookie, signed quote binding, booking creation/retry, ICS export and cancellation.
- Digilist approval configuration, cross-tenant rejection, failure-versus-unavailability and preserving existing room rules when editing.

## Manual browser acceptance — outstanding

The available preview browser rejected local application URLs under its URL policy. No browser screenshots or successful visual/interaction test are claimed. Before launch, review the built app in desktop and mobile browsers:

1. Room-first and date-first routes both preserve the selected interval into confirmation.
2. Keyboard-only room selection, login, calendar, modal, confirmation and cancellation. Check visible focus, label announcements, status messages and dialog focus return.
3. At 360, 390, 768 and 1440px: no page-wide overflow, clipped calendar controls or actions under the bottom navigation; admin switches to a readable agenda on phones.
4. Light/dark colors, contrast, self-hosted fonts and Digilist asset alignment. Verify floor-plan readability and replace room placeholders with approved photographs when available.
5. Filter with zero results, delayed availability, API failure, stale slot, stale price and expired login. Back navigation must preserve a user's meaningful selection.
6. Double-click confirmation and retry after a lost response. Check Mine bookinger before creating a new attempt.

## Customer tenant acceptance — outstanding

Use a dedicated staging tenant. Confirm the deployment matches the reviewed API contracts, then run free direct booking, approval-required booking, rejection, cancellation, edit request and admin blocking with two distinct users. Repeat a simultaneous booking attempt from separate sessions: exactly one can reserve the same room/time. Verify opening hours and buffer rules in Oslo winter and summer, plus membership revocation and cross-tenant denial.

Agree on paid-booking behavior before enabling it. Confirm actual invoice/email/calendar behavior in Digilist rather than relying on demo presentation. Verify that contact details, accessibility information, both Eidefossen room names, capacities and photographs match the building.

Do not merge/deploy as a customer-ready release until these outstanding checks and configuration decisions are resolved. This is a reviewable implementation with a working isolated demo.
