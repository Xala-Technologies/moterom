# Møterom

A bilingual (Norwegian Bokmål default + English) meeting-room portal for one building, using Digilist's visual language and existing booking services. Includes a working local demo and a server-side Digilist integration adapter.

**Status:** Frivillighetens Hus portal branch. Intended production origin is `https://fhh.digilist.no`. The Digilist tenant, confirmed capacities, photos and address are not in this repository yet — see [the FHH portal note](docs/fhh-private-portal.md). SKB stays on `dev`/`main` and `skb.digilist.no`. Do not point SKB hosting at this branch. Expansion rules are in [multi-tenant private portals](docs/multi-tenant-portals.md).

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`. Digilist login (email OTP and SMS OTP) appears when `DIGILIST_URL` and `DIGILIST_HTTP_URL` are set; the BFF calls Digilist’s auth APIs. Without those URLs, only demo sign-in is offered. In `DATA_MODE=demo`, **Fortsett i demo** and **Prøv som kunde** remain available even when Digilist auth URLs are set. The demo stores fictional reservations and booking-message history in `.data/demo.sqlite`. Support threads and building announcements use `.data/messaging_local.sqlite` (demo and live). Those files are real SQLite history, not UI mocks; remove them while the server is stopped to reset. On Vercel demo, `/tmp` paths are ephemeral. Live booking messages live in Digilist; live support/announcements still need a **persistent** `MESSAGING_LOCAL_DB_PATH` (never `/tmp` in production). The demo sends no email and collects no payment.

```sh
npm run check
npm run format:check
```

Day-to-day work lands on `dev`; releases are pull requests from `dev` into `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

The test suite covers booking conflicts, idempotency, ownership, role checks, signed quotes, cancellation, calendar exports, Oslo daylight-saving transitions, and selected Digilist adapter contracts.

## Product flow

- **Find a room:** room cards for the Frivillighetens Hus catalogue, date/time/attendee filter and an optional privately configured floor plan. Only rooms available for the entire selected interval are shown after filtering. A service failure is displayed as an error, never as a trustworthy availability result.
- **Book:** choose the room and date/time → sign in if necessary → review and confirm. Availability and price are checked again on the server. A room that requires approval produces a request, not a false confirmation. After confirm, the customer sees the booking detail (cancel, calendar download, book again, and a request to change time). The original reservation remains in place until an edit is approved in Digilist.
- **Administration:** daily overview, day/7-day room calendar, customer/reference search, status filters, approve/reject, room content/capacity/approval editing, and maintenance blocks. Admin → Brukere lists Digilist members and a local access-request inbox; **Godkjenn tilgang** grants Møterom portal access (Digilist booker sync is best-effort). Opening hours, buffers and paid listing tools stay in Digilist until wrapped APIs exist. Møterom has no payments.
- **Mobile:** stacked booking controls, room cards, and an agenda in place of the wide admin timeline. Administrators also get header and bottom navigation to Finn rom and Administrasjon. Light/dark themes, labelled inputs, keyboard-operable dialogs, focus styles, skip link and status announcements are included.

## Design provenance

The application uses **Inter**, Digilist's navy **#003057**, its actual theme tokens, form overrides, light/dark palettes and spacing. Form primitives come from Digdir Designsystemet. The header switches area (Finn rom, Dashboard or Administrasjon). Dashboard and administration keep the left sidebar.

The unchanged files in `src/design/digilist/` and `public/digilist-logo.svg` were sourced from the private `Xala-Technologies/digilist` repository at commit `16a8025d52cc69b917f9c255cc3ef5e1637bb0c7`. See [the design source record](docs/design-source.md). Application styling is kept in `src/styles.css` so the source tokens remain reviewable. These internal brand files are not being relicensed as an open-source design system.

Room names come from Ingvild’s specification and the 13 October 2026 meeting. Capacities, equipment, prices, address and photographs are not in those documents and are not invented here. The fifth small room is listed as **Styrerommet** until the customer confirms Styrerommet vs Syerommet. Sal 1–2 / Sal 1–3 are not separate catalogue rows until the booking engine can block overlapping zones. See [`config/rooms.json`](config/rooms.json) and [docs/fhh-private-portal.md](docs/fhh-private-portal.md).

| Room        | Source capacity | Notes                              |
| ----------- | --------------- | ---------------------------------- |
| Elvebredden | unknown         |                                    |
| Biblioteket | unknown         |                                    |
| Salongen    | unknown         |                                    |
| Spisestuen  | unknown         |                                    |
| Styrerommet | unknown         | Name needs confirmation            |
| Sal 1       | unknown         | Zone combinations not enforced     |
| Sal 2       | unknown         | Zone combinations not enforced     |
| Sal 3       | unknown         | Zone combinations not enforced     |
| Bakgården   | unknown         | Internal-only rule not implemented |

## Connect Digilist

1. Set a real resource `slug` for each entry in `config/rooms.json` only after the DEV Frivillighetens Hus tenant rooms exist. IDs in this file are stable portal IDs; do not replace them with guessed Convex IDs. Live rooms must belong to `DIGILIST_TENANT_ID`, be published/active, `visibility=private`, and `accessChannel=tenant_portal`.
2. Set `DATA_MODE=live`, `DIGILIST_TENANT_ID`, `DIGILIST_URL` (Convex SDK: `https://convex-api.dev.digilist.no` for isolated work), and `DIGILIST_HTTP_URL` (REST: `https://convex.dev.digilist.no`). Do not swap those two URLs. Set `ADMIN_EMAILS` to the Digilist account(s) allowed to open Møterom Admin. Admin also requires an active Digilist tenant role (`tenant_admin`, `saksbehandler`, or legacy `owner`/`admin`/`manager`/`staff`) on that tenant.
3. Set `PUBLIC_ORIGIN` to the exact HTTPS origin, without a trailing slash (`https://fhh.digilist.no` in production, `http://localhost:4173` locally). Generate a random `SESSION_SECRET` with at least 32 characters and provide it through the deployment's secret manager.
4. Set `BOOKING_ACCESS=members` so the portal is login-first and only Digilist building members can use rooms and booking. Access requests appear under Admin → Users; approving or removing membership is still done in Digilist.
5. Add building name, address and contact email when the customer confirms them. Confirm room names, capacities, images, equipment, opening hours, minimum durations, turnaround time, cancellation rules and approval requirements in Digilist. Do not invent catalogue facts in this repository.
6. Leave `PAYMENT_MODE` unset on `fhh.digilist.no`. A paid quote fails closed in the BFF; the portal does not redirect to app.digilist.no. Run [staging acceptance](docs/acceptance.md) against the FHH tenant once it exists.

Production defaults to live mode and refuses incomplete configuration. Demo login exists only in demo mode. Running a production demo requires both `DATA_MODE=demo` and the explicit `ALLOW_DEMO_DEPLOYMENT=true`; it still requires HTTPS and a strong session secret. Never enable that setting on the customer deployment.

### Payment boundary

This portal still refuses paid quotes. The live adapter calls authenticated `domain/bookings:create` and refuses a Digilist quote with a total greater than zero. It does not open guest checkout or app.digilist.no. Keep rooms free in Digilist for an internal pilot, or leave them unpublished until price rules are agreed. Do not zero prices in this repository to fake a paid product.

`PAYMENT_MODE=invoice` is not used on `fhh.digilist.no`. This application does not create invoices, charge cards, or claim email/SMS receipts unless the corresponding service confirmed them.

## Architecture

```text
src/                React customer/admin screens (nb/en via i18next)
src/design/digilist/ Unmodified Digilist theme files
server/             Express BFF, encrypted sessions, provider adapters
shared/             Types, validation, Europe/Oslo time handling
config/rooms.json   Stable seven-room inventory and live slug mapping
assets/             Instructions for mounting an approved private floor plan
tests/              Domain, HTTP boundary and adapter regression tests
docs/               Integration, source provenance and acceptance notes
```

The browser calls the same-origin Express backend. Live mode uses Digilist's existing REST authentication and Convex domain facades (`getBySlug`, `bookings.create`); it does not run a second production booking database. The local SQLite provider is demo-only. No service/admin API key is embedded in the browser. Digilist rechecks its own permissions and authoritative booking rules.

The supplied floor-plan image is excluded from the repository because automatic review did not approve uploading that private attachment. Set `FLOORPLAN_PATH` to an approved, privately mounted PNG to enable the floor-plan control. It follows the room catalogue's access gate; see `assets/README.md`.

Email-code sign-in and MFA reuse Digilist. The opaque Digilist session and short-lived Convex access token remain in an encrypted, HttpOnly, SameSite cookie (Secure and `__Host-` in production) for up to 30 days, matching Digilist stay-logged-in. Every authenticated request revalidates the live session; production writes accept only the configured Origin, regardless of forwarded Host headers. Admin access is bound to `ADMIN_EMAILS` **and** a Digilist tenant admin role on this building. Booking identity comes from that verified session, never from a browser-provided customer ID.

Signed five-minute quotes bind the reviewed room, interval, attendees, price and approval mode to the user. Booking submissions retain their idempotency key and exact booking details on an uncertain network result. Live idempotency keys are namespaced by tenant and user. A matching committed booking is recovered before quote-expiry and occupied-slot checks; quote renewal preserves the retry key. Changed retry details are rejected. Replay currently searches the latest 500 user bookings; a dedicated atomic idempotency endpoint remains an upstream requirement. Changing or reloading the entire checkout is a new transaction. Digilist is the authority for write-time conflicts and final pricing.

Admin history currently loads at most 1,000 bookings and shows a warning at the cap; customers load up to 500 and see the same style of warning when that cap is hit. Full tenant history remains in Digilist. The app uses request-based refresh, not live subscription updates. Recurring bookings, waitlists, door access, catering, automatic reminders and payment collection are outside this first implementation.

## Build and deploy

```sh
npm run build
npm start
```

A Node service and HTTPS reverse proxy are required; this is not a static-only Vite site. All API requests must reach the same host as the frontend. Do not cache `/api/*`. The included Dockerfile runs as the unprivileged `node` user. Runtime configuration is injected when starting the container; no `.env` or database is copied into it.

The initial rate limiter is process-local and intentionally does not trust forwarded IP headers. Before scaling behind a proxy, configure a verified proxy topology and a shared rate limiter at the edge. Use the hosting platform for health checks, server-error monitoring and secret rotation. Customer booking data remains subject to Digilist's existing operational policies.

See [integration contracts](docs/digilist-integration.md) and [acceptance checks](docs/acceptance.md). Browser verification and live staging validation are explicitly outstanding; passing local tests does not substitute for them.
