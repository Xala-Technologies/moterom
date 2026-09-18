# Acceptance record

## Automated locally

Run `npm run check` and `npm run format:check` on Node 24. The suite covers:

- Oslo UTC offsets; nonexistent and ambiguous DST times; adjacent and overlapping intervals; insights clipping, pending exclusion, truncation and previous-period zero change.
- One booking for repeated idempotent submissions; changed-body rejection; capacity, ownership and admin access.
- Maintenance blocks and cancellation releasing availability; edit requests preserving original reservations.
- HTTP authentication, Origin enforcement, HttpOnly cookie, signed quote binding, booking creation/retry, ICS export and cancellation.
- Administrator approve, reject, block create/delete, room PATCH, and insights reads, including customer 403s.
- Digilist approval configuration, cross-tenant rejection, failure-versus-unavailability and preserving existing room rules when editing.
- Digilist approval configuration, cross-tenant rejection, failure-versus-unavailability, tenant_portal catalogue, and paid-quote fail-closed.

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

Contract: [`docs/shared-digilist-dashboard.md`](shared-digilist-dashboard.md). Rebuild Digilist tenant-admin IA in Møterom; do not copy private dashboard source. Digilist stays the booking and membership backend. Access-request approve does not call `inviteMember`.

## Manual browser acceptance — still outstanding for launch

Before launch, review the built app in desktop and mobile browsers outside this agent session:

1. Keyboard-only room selection, login, calendar, modal, confirmation and cancellation. Check visible focus, label announcements, status messages and dialog focus return on a physical keyboard.
2. Floor-plan readability when `FLOORPLAN_PATH` is set; replace illustrative photos with approved building photographs when available.
3. Filter with zero results, delayed availability, API failure, stale slot, stale price and expired login.
4. Double-click confirmation and retry after a lost response on an unreliable network.

## Customer tenant acceptance — outstanding

Use a dedicated staging tenant. Confirm the deployment matches the reviewed API contracts, then run free direct booking, approval-required booking, rejection, cancellation, edit request and admin blocking with two distinct Digilist users: one Digilist tenant-admin (owner/admin or equivalent for `DIGILIST_TENANT_ID`) who signs in with Digilist email and reaches `/admin`, and one customer Digilist user who reaches Mine bookinger and is denied admin APIs. Repeat a simultaneous booking attempt from separate sessions: exactly one can reserve the same room/time. Verify opening hours and buffer rules in Oslo winter and summer, plus membership revocation and cross-tenant denial.

Møterom has no payments or invoices. Keep the rooms free and verify an atomic upstream no-payment policy, including changes between quote and write. Confirm actual email/calendar behavior in Digilist rather than relying on demo presentation. Verify that contact details, accessibility information, both Eidefossen room names, capacities and photographs match the building.

Do not merge/deploy as a customer-ready release until these outstanding checks and configuration decisions are resolved. This is a reviewable implementation with a working isolated demo.

## SKB private portal (17 September 2026)

Møterom `feat/skb-private-portal` (baseline `6cd4730` plus this work). Digilist sibling `feat/tenant-portal-listings` from `origin/dev` `f5a6c8f` — **not** pushed to Digilist `dev`/`main`.

- Local `npm run check` and `format:check` passed (55 tests). Digilist targeted Convex tests passed (163).
- Digilist DEV tenant `skb-moterom-test` (`xx7b7h1xq7tj0c2p581tzffyzn8ej4pd`) and seven private `tenant_portal` rooms were seeded. `config/rooms.json` slugs are filled. Marketplace REST leak checks passed (slug 404, guest checkout 404, public listing still 200). See [`docs/skb-private-portal.md`](skb-private-portal.md).
- Local demo browser: grid confirm modal booked Sauda 1 without payment redirect; customer admin 403; phone 390×844 no overflow.
- Still open: no git merge of `feat/digilist-admin-foundation` to `dev`/`main`; live member OTP booking was not run; Eidefossen names still need confirmation. Hostinger `skb.digilist.no` is **live** and members-only (anonymous config 18 Sep 2026); it does not yet serve this branch (`/api/admin/members` 404).

## Integration repairs — 18 September 2026

See [the current integration review](architecture/moterom-digilist-review-2026-09-18.md) and [`shared-digilist-dashboard.md`](shared-digilist-dashboard.md). Historical rollout notes above are dated records.

Node 24: `npm run check` and `format:check` passed (86 tests across 15 files, typecheck, production build). New checks use mocked Digilist contracts; they do not prove live tenant state or transactional concurrency.

Local demo browser at `http://localhost:4173` (Chromium in Cursor): login showed email, SMS, BankID, access request, **Fortsett i demo** and **Prøv som kunde**; demo admin landed on `/admin`; Users had no Digilist deep-link and demo inbox copy; Settings showed membership-from-Digilist copy, a single Digilist link for hours/prices, and no payment settings. Dark theme and English on Settings remained readable. Not claimed: phone overflow measurement, keyboard-only pass, VoiceOver, live OTP, or Digilist `inviteMember`.

Launch blockers include authenticated tenant verification (OTP), durable upstream idempotency, an atomic no-payment policy and a booking-only membership contract. Marketplace public-slug isolation was re-checked 18 September 2026 against Digilist DEV REST (see [`skb-private-portal.md`](skb-private-portal.md)). Møterom's request inbox no longer grants access independently of Digilist. Full Digilist dashboard migration is not complete.

## Live isolation re-check — 18 September 2026 (afternoon)

Anonymous only. No OTP, no bookings, no production tenant edits.

- Digilist DEV REST: `GET /listings/skb-test-*` 404 for all seven slugs; listings page and featured contain no `skb-test` slugs; `xala-test-konferanserom` still 200; `POST /checkout/sessions` with a complete guest body for `skb-test-sauda-1` 404 `No listing 'skb-test-sauda-1'`.
- Local BFF from this branch, `DATA_MODE=live` on port 4175 (then stopped): `/api/config` mode live / members; `/api/rooms`, `/api/admin`, `/api/admin/members`, `/api/admin/access-requests` 401 `login_required`; `POST /api/auth/demo` 404 (no demo fallback).
- Hostinger `https://skb.digilist.no`: `/api/config` mode **live**, access members, Digilist auth configured; rooms and admin 401; `/api/admin/members` **404** (deployed image is not this branch). Login shows email, SMS and access request; no BankID and no demo. Cluster URLs behind that host were not read.

Still required: OTP as `skb@digilist.no` and `skb.member@digilist.dev` against a BFF on this branch pointed at DEV.
