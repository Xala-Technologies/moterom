# Møterom

A Norwegian meeting-room portal for one building, using Digilist's visual language and existing booking services. Includes a working local demo and a server-side Digilist integration adapter.

**Status:** implemented for review. Production needs the building's tenant configuration, seven published room slugs, and staging acceptance. No live customer data or Digilist configuration was changed while building this application.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`. Use **Logg inn → Prøv som kunde** or **Prøv som administrator**. The demo has an explicit banner and stores fictional reservations in `.data/demo.sqlite`. It sends no email and collects no payment. Remove that disposable database while the server is stopped to reset the demo.

```sh
npm run check
npm run format:check
```

The test suite covers booking conflicts, idempotency, ownership, role checks, signed quotes, cancellation, calendar exports, Oslo daylight-saving transitions, and selected Digilist adapter contracts.

## Product flow

- **Find a room:** seven room cards, date/time/attendee filter, grid/list display and an optional privately configured floor plan. Only rooms available for the entire selected interval are shown after filtering. A service failure is displayed as an error, never as a trustworthy availability result.
- **Book:** choose the room and date/time → sign in if necessary → review and confirm. Availability and price are checked again on the server. A room that requires approval produces a request, not a false confirmation.
- **Mine bookinger:** upcoming/history, details, cancellation, calendar download, book again, and a request to change time. The original reservation remains in place until an edit is approved in Digilist.
- **Administration:** daily overview, day/7-day room calendar, customer/reference search, status filters, approve/reject, room content/capacity/approval editing, and maintenance blocks. Existing Digilist screens handle pricing, opening hours, staff access and edit approval.
- **Mobile:** stacked booking controls, room cards, bottom navigation and an agenda in place of the wide admin timeline. Light/dark themes, labelled inputs, keyboard-operable dialogs, focus styles, skip link and status announcements are included.

## Design provenance

The application uses **Inter**, Digilist's navy **#003057**, its actual theme tokens, form overrides, light/dark palettes and spacing. Form primitives come from Digdir Designsystemet. The customer header and admin sidebar follow Digilist's existing application structure.

The unchanged files in `src/design/digilist/` and `public/digilist-logo.svg` were sourced from the private `Xala-Technologies/digilist` repository at commit `16a8025d52cc69b917f9c255cc3ef5e1637bb0c7`. See [the design source record](docs/design-source.md). Application styling is kept in `src/styles.css` so the source tokens remain reviewable. These internal brand files are not being relicensed as an open-source design system.

The seven rooms and capacity ranges come from the supplied _Oversikt møterom.pdf_. The demo conservatively uses the lower capacity bound. The PDF contains two rooms called Eidefossen; they are temporarily distinguished by capacity. No equipment, room photographs, prices or building address were invented.

| Room               | Source capacity | Demo capacity |
| ------------------ | --------------- | ------------- |
| Sauda 1            | 12–14           | 12            |
| Sauda 2            | 10–12           | 10            |
| Tysso              | 24–26           | 24            |
| Glomma 1           | 44–56           | 44            |
| Glomma 2           | 26–28           | 26            |
| Eidefossen · 12–14 | 12–14           | 12            |
| Eidefossen · 10–12 | 10–12           | 10            |

## Connect Digilist

1. Set a real resource `slug` for each entry in `config/rooms.json`. IDs in this file are stable portal IDs; do not replace them with guessed Convex IDs. Resources must belong to the configured building tenant and be published for the existing checkout endpoint.
2. Set `DATA_MODE=live`, `DIGILIST_TENANT_ID`, `DIGILIST_URL` (Convex deployment), and `DIGILIST_HTTP_URL` (HTTP actions).
3. Set `PUBLIC_ORIGIN` to the exact HTTPS origin, without a trailing slash. Generate a random `SESSION_SECRET` with at least 32 characters and provide it through the deployment's secret manager.
4. Choose `BOOKING_ACCESS=members` for a tenant-only portal, or `public` for an open room catalogue with sign-in required to book. A members-only portal does not make an otherwise published listing private elsewhere on Digilist; agree on that platform policy before launch.
5. Add building name, address and contact email. Confirm room names, capacities, images, equipment, opening hours, minimum durations, turnaround time, cancellation rules and approval requirements in Digilist.
6. Keep `PAYMENT_MODE=hosted` unless the owner has explicitly chosen an established invoice process. Run [staging acceptance](docs/acceptance.md) before enabling customer bookings.

Production defaults to live mode and refuses incomplete configuration. Demo login exists only in demo mode. Running a production demo requires both `DATA_MODE=demo` and the explicit `ALLOW_DEMO_DEPLOYMENT=true`; it still requires HTTPS and a strong session secret. Never enable that setting on the customer deployment.

### Payment boundary

Free bookings can be confirmed here. Paid bookings normally continue to the existing Digilist listing/checkout flow. **This handoff does not transfer the selected interval or authenticate the user into Digilist's separate website**, so the user may need to select those details/sign in again. The current REST checkout creates a booking but does not provide a payment-intent checkout URL. This application does not pretend that a redirect charges a card.

`PAYMENT_MODE=invoice` allows an unpaid reservation through the existing booking endpoint. It does **not** itself issue an invoice. Use it only when invoicing is already operational for this tenant. Approval-required and price-on-request arrangements need the owner's agreed workflow. Review this boundary before promising a three-step paid checkout.

## Architecture

```text
src/                React, Norwegian customer/admin screens
src/design/digilist/ Unmodified Digilist theme files
server/             Express BFF, encrypted sessions, provider adapters
shared/             Types, validation, Europe/Oslo time handling
config/rooms.json   Stable seven-room inventory and live slug mapping
assets/             Instructions for mounting an approved private floor plan
tests/              Domain, HTTP boundary and adapter regression tests
docs/               Integration, source provenance and acceptance notes
```

The browser calls the same-origin Express backend. Live mode uses Digilist's existing REST authentication/checkout and Convex domain facades; it does not run a second production booking database. The local SQLite provider is demo-only. No service/admin API key is embedded in the browser. Digilist rechecks its own permissions and authoritative booking rules.

The supplied floor-plan image is excluded from the repository because automatic review did not approve uploading that private attachment. Set `FLOORPLAN_PATH` to an approved, privately mounted PNG to enable the floor-plan control. It follows the room catalogue's access gate; see `assets/README.md`.

Email-code sign-in and MFA reuse Digilist. The opaque session and short-lived Convex access token remain in an encrypted, HttpOnly, SameSite cookie (Secure and `__Host-` in production). Every authenticated request revalidates the live session; all writes enforce the configured Origin. Admin access is bound to the building tenant and underlying Digilist permissions. Booking identity comes from that verified session, never from a browser-provided customer ID.

Signed five-minute quotes bind the reviewed room, interval, attendees, price and approval mode to the user. Booking submissions retain their idempotency key and exact booking details on an uncertain network result. Live idempotency keys are namespaced by tenant and user. If an old quote expires after an uncertain submission, customers are directed to check Mine bookinger; changing or reloading the entire checkout is a new transaction. Digilist is the authority for write-time conflicts and final pricing.

Admin history currently loads at most 1,000 bookings and shows a warning at the cap; customers load up to 500. Full tenant history remains in Digilist. The app uses request-based refresh, not live subscription updates. Recurring bookings, waitlists, door access, catering, automatic reminders and payment collection are outside this first implementation.

## Build and deploy

```sh
npm run build
npm start
```

A Node service and HTTPS reverse proxy are required; this is not a static-only Vite site. All API requests must reach the same host as the frontend. Do not cache `/api/*`. The included Dockerfile runs as the unprivileged `node` user. Runtime configuration is injected when starting the container; no `.env` or database is copied into it.

The initial rate limiter is process-local and intentionally does not trust forwarded IP headers. Before scaling behind a proxy, configure a verified proxy topology and a shared rate limiter at the edge. Use the hosting platform for health checks, server-error monitoring and secret rotation. Customer booking data remains subject to Digilist's existing operational policies.

See [integration contracts](docs/digilist-integration.md) and [acceptance checks](docs/acceptance.md). Browser verification and live staging validation are explicitly outstanding; passing local tests does not substitute for them.
