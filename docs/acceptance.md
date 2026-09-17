# Acceptance record

## Automated locally

Run `npm run check` and `npm run format:check` on Node 24. The suite covers:

- Oslo UTC offsets; nonexistent and ambiguous DST times; adjacent and overlapping intervals; insights clipping, pending exclusion, truncation and previous-period zero change.
- One booking for repeated idempotent submissions; changed-body rejection; capacity, ownership and admin access.
- Maintenance blocks and cancellation releasing availability; edit requests preserving original reservations.
- HTTP authentication, Origin enforcement, HttpOnly cookie, signed quote binding, booking creation/retry, ICS export and cancellation.
- Administrator approve, reject, block create/delete, room PATCH, and insights reads, including customer 403s.
- Digilist approval configuration, cross-tenant rejection, failure-versus-unavailability and preserving existing room rules when editing.
- Dashboard-to-listing URL mapping for hosted payment handoff.

## Manual browser — quality polish (local demo, Chromium in Cursor)

Verified on 16 September 2026 against `http://localhost:4173` in demo mode:

1. Date-first search for 17 Sep 2026 09:00–10:00 showed 6 available rooms and hid occupied Tysso, with error vs occupied still distinct.
2. Clicking a room card (photo, name or **Book nå**) opened `/ny-booking?rom=tysso`. `/rom/tysso` redirected to the same wizard. Wizard without `rom` (admin **Ny booking** URL) showed a room list on step 1 after a date was chosen, then slots. Wizard **Tilbake** from a card returned to the listing.
3. Wizard stepper was **Dato og tid → Kontakt → Bekreft**. Date empty until chosen; Sauda 2 stayed on step 1 slots; occupied 09:00–10:00 could not continue; step 2 required name and email, phone optional, and did not claim SMS or e-post; demo guest confirmed (`Bookingen er bekreftet`) with phone shown on the confirmation page.
4. `/bestill/sauda-1?…` redirected into step 2 Kontakt. Dark theme and light theme both remained usable. Viewport 360: `documentElement.scrollWidth` did not exceed the viewport on Kontakt or Bekreft.
5. Illustrative WebP images loaded and showed **Illustrasjonsfoto**. Admin overview used “Pågår nå”. Week view prev/next were “Forrige uke” / “Neste uke”.
6. Listing cards, search panel and results heading used stronger existing Digilist borders, type and shadows (no new palette). Light and dark on `/` both kept cards distinct from the page background. Viewport 360: listing `scrollWidth` did not exceed the viewport.

## Manual browser — admin insights (local demo, Chromium in Cursor)

Verified on 16 September 2026 against `http://localhost:4173` in demo mode:

1. Oversikt showed **Pågår nå** (not “Rom ledige akkurat nå”), today’s schedule empty-state, and the room calendar.
2. Sidebar **Innsikt** (`/admin/innsikt`) showed the Demodata coverage banner, period/room filters (room scopes the trend), compare checkbox with dual bars, Recharts weekly/monthly trend with detail panel (hours + booking count + date range), and room table. Reloading `/admin/innsikt?periode=7d&sammenlign=1` restored the same filters. Legacy `/admin?visning=innsikt` redirected to `/admin/innsikt`.
3. Dark theme on Innsikt remained readable. Device-metrics override did not shrink the Cursor browser below ~600px; no horizontal overflow was measured at that width.

Not claimed: VoiceOver/NVDA, Safari/Firefox, 200% zoom measurement, physical device keyboard, live Digilist, or production.

## Languages (nb / en)

UI catalogs live in `src/i18n/locales/{nb,en}.json`. Default locale is **nb**. Explicit choice is stored in `localStorage` (`moterom.locale`) and cookie `moterom_locale`. Header switcher cycles NB ↔ EN. API errors and insights prose resolve from the cookie / `Accept-Language`. Room names and customer-entered fields are not translated; curated room copy uses `descriptionEn` / `capacityLabelEn`.

## Shared Digilist admin presentation

Contract: [`docs/shared-digilist-dashboard.md`](shared-digilist-dashboard.md). Digilist is backend-only for Møterom. Admin booking list UI is Møterom-owned (`src/components/admin/`) and Digilist-inspired via existing design tokens. No Digilist source changes and no vendored Digilist UI package.

## Manual browser acceptance — still outstanding for launch

Before launch, review the built app in desktop and mobile browsers outside this agent session:

1. Keyboard-only room selection, login, calendar, modal, confirmation and cancellation. Check visible focus, label announcements, status messages and dialog focus return on a physical keyboard.
2. Floor-plan readability when `FLOORPLAN_PATH` is set; replace illustrative photos with approved building photographs when available.
3. Filter with zero results, delayed availability, API failure, stale slot, stale price and expired login.
4. Double-click confirmation and retry after a lost response on an unreliable network.

## Customer tenant acceptance — outstanding

Use a dedicated staging tenant. Confirm the deployment matches the reviewed API contracts, then run free direct booking, approval-required booking, rejection, cancellation, edit request and admin blocking with two distinct Digilist users: one Digilist tenant-admin (owner/admin or equivalent for `DIGILIST_TENANT_ID`) who signs in with Digilist email and reaches `/admin`, and one customer Digilist user who reaches Mine bookinger and is denied admin APIs. Repeat a simultaneous booking attempt from separate sessions: exactly one can reserve the same room/time. Verify opening hours and buffer rules in Oslo winter and summer, plus membership revocation and cross-tenant denial.

Agree on paid-booking behavior before enabling it. Confirm actual invoice/email/calendar behavior in Digilist rather than relying on demo presentation. Verify that contact details, accessibility information, both Eidefossen room names, capacities and photographs match the building.

Do not merge/deploy as a customer-ready release until these outstanding checks and configuration decisions are resolved. This is a reviewable implementation with a working isolated demo.
