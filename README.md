# Møterom

A bilingual (Norwegian Bokmål default + English) meeting-room portal for one building, using Digilist's visual language and existing booking services. Includes a working local demo and a server-side Digilist integration adapter.

**Status:** implemented for review. Production needs the building's tenant configuration, seven published room slugs, and staging acceptance. No live customer data or Digilist configuration was changed while building this application.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`. Digilist login (email OTP, SMS OTP, BankID) appears when `DIGILIST_URL` and `DIGILIST_HTTP_URL` are set; the BFF calls Digilist’s auth APIs. Without those URLs, only demo sign-in is offered. In demo mode, **Fortsett i demo** remains available for a local session. BankID on `localhost` may require Digilist `EXTRA_CORS_ORIGINS` to include `PUBLIC_ORIGIN`. Customer demo login is parked in `src/pages/Login.tsx` (`SHOW_DEMO_CUSTOMER_LOGIN`). The demo stores fictional reservations in `.data/demo.sqlite`. It sends no email and collects no payment. Remove that disposable database while the server is stopped to reset the demo.

```sh
npm run check
npm run format:check
```

Day-to-day work lands on `dev`; releases are pull requests from `dev` into `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

The test suite covers booking conflicts, idempotency, ownership, role checks, signed quotes, cancellation, calendar exports, Oslo daylight-saving transitions, and selected Digilist adapter contracts.

## Product flow

- **Find a room:** seven room cards, date/time/attendee filter, grid/list display and an optional privately configured floor plan. Only rooms available for the entire selected interval are shown after filtering. A service failure is displayed as an error, never as a trustworthy availability result.
- **Book:** choose the room and date/time → sign in if necessary → review and confirm. Availability and price are checked again on the server. A room that requires approval produces a request, not a false confirmation. After confirm, the customer sees the booking detail (cancel, calendar download, book again, and a request to change time). The original reservation remains in place until an edit is approved in Digilist.
- **Administration:** daily overview, day/7-day room calendar, customer/reference search, status filters, approve/reject, room content/capacity/approval editing, and maintenance blocks. Existing Digilist screens handle pricing, opening hours, staff access and edit approval.
- **Mobile:** stacked booking controls, room cards, and an agenda in place of the wide admin timeline. Administrators also get header and bottom navigation to Finn rom and Administrasjon. Light/dark themes, labelled inputs, keyboard-operable dialogs, focus styles, skip link and status announcements are included.

## Design provenance

The application uses **Inter**, Digilist's navy **#003057**, its actual theme tokens, form overrides, light/dark palettes and spacing. Form primitives come from Digdir Designsystemet. The customer header and admin sidebar follow Digilist's existing application structure.

The unchanged files in `src/design/digilist/` and `public/digilist-logo.svg` were sourced from the private `Xala-Technologies/digilist` repository at commit `16a8025d52cc69b917f9c255cc3ef5e1637bb0c7`. See [the design source record](docs/design-source.md). Application styling is kept in `src/styles.css` so the source tokens remain reviewable. These internal brand files are not being relicensed as an open-source design system.

The seven rooms and capacity ranges come from the supplied _Oversikt møterom.pdf_. The demo conservatively uses the lower capacity bound. The PDF contains two rooms called Eidefossen; they are temporarily distinguished by capacity. No equipment, prices or building address were invented. Catalogue images are licensed **illustrative** photographs, labelled in the UI and recorded in [docs/room-images.md](docs/room-images.md), until approved building photographs exist.

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

1. Set a real resource `slug` for each entry in `config/rooms.json` only after the DEV SKB-test tenant rooms exist. IDs in this file are stable portal IDs; do not replace them with guessed Convex IDs. Live rooms must belong to `DIGILIST_TENANT_ID`, be published/active, `visibility=private`, and `accessChannel=tenant_portal`.
2. Set `DATA_MODE=live`, `DIGILIST_TENANT_ID`, `DIGILIST_URL` (Convex SDK: `https://convex-api.dev.digilist.no` for isolated work), and `DIGILIST_HTTP_URL` (REST: `https://convex.dev.digilist.no`). Do not swap those two URLs. Set `ADMIN_EMAILS` to the Digilist account(s) allowed to open Møterom Admin (default for non-production: `skb@digilist.no`). Admin also requires an active Digilist tenant role (`tenant_admin`, `saksbehandler`, or legacy `owner`/`admin`/`manager`/`staff`) on that tenant.
3. Set `PUBLIC_ORIGIN` to the exact HTTPS origin, without a trailing slash (`https://skb.digilist.no` in production, `http://localhost:4173` locally). Generate a random `SESSION_SECRET` with at least 32 characters and provide it through the deployment's secret manager.
4. Set `BOOKING_ACCESS=members` so the portal is login-first and only Digilist building members can use rooms and booking. Access requests appear under Admin → Users; approving or removing membership is still done in Digilist.
5. Add building name, address and contact email. Confirm room names, capacities, images, equipment, opening hours, minimum durations, turnaround time, cancellation rules and approval requirements in Digilist. Do not invent catalogue facts in this repository.
6. Leave `PAYMENT_MODE` unset on the SKB live target. Rooms must be free/internal in Digilist. A paid quote fails closed in the BFF; the portal does not redirect to app.digilist.no. Run [staging acceptance](docs/acceptance.md). Live `skb.digilist.no` uses `DATA_MODE=live` against the isolated Digilist DEV tenant until a production Digilist tenant is approved.

Production defaults to live mode and refuses incomplete configuration. Demo login exists only in demo mode. Running a production demo requires both `DATA_MODE=demo` and the explicit `ALLOW_DEMO_DEPLOYMENT=true`; it still requires HTTPS and a strong session secret. Never enable that setting on the customer deployment.

### Payment boundary

SKB bookings are internal and free. The live adapter calls authenticated `domain/bookings:create` and refuses a Digilist quote with a total greater than zero. It does not open guest checkout or app.digilist.no. Configure the seven rooms as free in Digilist rather than zeroing prices in this repository.

`PAYMENT_MODE=invoice` is not used on the SKB live target. This application does not create invoices, charge cards, or claim email/SMS receipts unless the corresponding service confirmed them.

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

Email-code sign-in and MFA reuse Digilist. The opaque Digilist session and short-lived Convex access token remain in an encrypted, HttpOnly, SameSite cookie (Secure and `__Host-` in production) for up to 30 days, matching Digilist stay-logged-in. Every authenticated request revalidates the live session; all writes enforce the configured Origin. Admin access is bound to `ADMIN_EMAILS` **and** a Digilist tenant admin role on this building. Booking identity comes from that verified session, never from a browser-provided customer ID.

Signed five-minute quotes bind the reviewed room, interval, attendees, price and approval mode to the user. Booking submissions retain their idempotency key and exact booking details on an uncertain network result. Live idempotency keys are namespaced by tenant and user. If an old quote expires after an uncertain submission, customers retry the same confirmation; changing or reloading the entire checkout is a new transaction. Digilist is the authority for write-time conflicts and final pricing.

Admin history currently loads at most 1,000 bookings and shows a warning at the cap; customers load up to 500. Full tenant history remains in Digilist. The app uses request-based refresh, not live subscription updates. Recurring bookings, waitlists, door access, catering, automatic reminders and payment collection are outside this first implementation.

## Build and deploy

```sh
npm run build
npm start
```

A Node service and HTTPS reverse proxy are required; this is not a static-only Vite site. All API requests must reach the same host as the frontend. Do not cache `/api/*`. The included Dockerfile runs as the unprivileged `node` user. Runtime configuration is injected when starting the container; no `.env` or database is copied into it.

The initial rate limiter is process-local and intentionally does not trust forwarded IP headers. Before scaling behind a proxy, configure a verified proxy topology and a shared rate limiter at the edge. Use the hosting platform for health checks, server-error monitoring and secret rotation. Customer booking data remains subject to Digilist's existing operational policies.

See [integration contracts](docs/digilist-integration.md) and [acceptance checks](docs/acceptance.md). Browser verification and live staging validation are explicitly outstanding; passing local tests does not substitute for them.
