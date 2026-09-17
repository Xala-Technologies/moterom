# Digilist integration contracts

Reviewed against `Xala-Technologies/digilist` commit `16a8025d52cc69b917f9c255cc3ef5e1637bb0c7`. These are source-reviewed contracts, not a claim that the customer's live deployment has been tested.

| Capability                   | Existing operation                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email code                   | REST `POST /api/v1/auth/email/request`, `POST /api/v1/auth/email/verify`                                                                                                                            |
| SMS code                     | REST `POST /api/v1/auth/sms/request`, `POST /api/v1/auth/sms/verify`                                                                                                                                |
| BankID                       | Convex `auth/start:startOAuth` (`provider: "bankid"`), callback via `/auth/callback` → BFF `POST /api/auth/session`                                                                                 |
| Session identity             | REST `GET /api/v1/auth/me`                                                                                                                                                                          |
| Convex access token          | REST `POST /api/v1/auth/token` with the opaque session token                                                                                                                                        |
| Tenant context               | Convex `auth/sessions:switchTenant`                                                                                                                                                                 |
| MFA                          | Convex action `auth/mfaChallenge:confirmMfaLoginChallenge`                                                                                                                                          |
| Published rooms              | Convex `domain/resources:getBySlug` (session + `DIGILIST_TENANT_ID`; `accessChannel=tenant_portal`)                                                                                                 |
| Whole-interval availability  | Convex `domain/bookings:validateBookingSlot`                                                                                                                                                        |
| Authoritative quote          | Convex `domain/pricing:quote` (total must be 0; paid quotes fail closed)                                                                                                                            |
| Idempotent creation          | Convex `domain/bookings:create` with `metadata.moteromIdempotencyKey` namespaced `tenantId:userId:key`                                                                                              |
| Customer bookings            | Convex `domain/bookings:listMine`, `domain/bookings:get`                                                                                                                                            |
| Customer cancellation        | REST `POST /api/v1/me/bookings/:id/cancel`                                                                                                                                                          |
| Change request               | Convex `domain/bookings:requestBookingEdit`                                                                                                                                                         |
| Admin bookings               | Convex `domain/bookings:list`, `approve`, `reject`, `cancel`                                                                                                                                        |
| Admin insights (Møterom BFF) | `GET /api/admin/insights` aggregates `domain/bookings:list` with `startAfter`/`startBefore`, a 36-hour lookback, internal paging, and a completeness flag. This is not Digilist `domain/analytics`. |
| Room content                 | Convex `domain/resources:update`                                                                                                                                                                    |
| Maintenance blocks           | Convex `domain/blocks:list`, `checkAvailability`, `create`, `remove`                                                                                                                                |

The BFF restricts all resources to seven configured slugs and verifies their tenant IDs. Read models sent to the client are normalized; raw user, moderation and backend metadata are not passed through. Customer booking reads are restricted to the authenticated owner. Admin list/block reads require a freshly verified member/admin of the configured tenant before calling the underlying facade.

### Building administrators

Møterom Admin requires **both** a Digilist email listed in `ADMIN_EMAILS` (comma-separated, case-insensitive) **and** an admin-capable Digilist tenant role on `DIGILIST_TENANT_ID` (`tenant_admin`, `saksbehandler`, or legacy `owner`/`admin`/`manager`/`staff`). Production live deployments must set at least one allowlisted address. Digilist tenant roles alone do not open `/admin`. Allowlisted emails without tenant membership do not open `/admin`.

1. Put the administrator’s Digilist email in `ADMIN_EMAILS` (this building uses `skb@digilist.no`) and add them to the building tenant in Digilist with an admin-capable role.
2. They sign in on Møterom with Digilist email OTP, SMS OTP, or BankID.
3. After login, the BFF sets `isAdmin` only when both checks pass and redirects them to `/admin`.

Other Digilist accounts (even Digilist tenant admins) are not Møterom admins unless listed in `ADMIN_EMAILS`. They land on Mine bookinger or the access-pending screen and receive 403 on `/api/admin`. Demo mode still offers «Logg inn som administrator» for local testing without Digilist.

### Access requests (Admin → Brukere)

When `BOOKING_ACCESS=members`, non-members can submit a local access request (`POST /api/access-requests`, SQLite). Admin → **Brukere** can approve or decline.

Portal `isMember` is true when either:

1. Digilist `/auth/me` reports `tenantId` matching `DIGILIST_TENANT_ID`, or
2. That email has an **approved** access request in Møterom.

Without Digilist membership and without approval, the user stays on the access-pending screen. Rejecting a request removes portal access granted via (2). Digilist tenant switch failures no longer block session creation; the membership checks above decide access after login.

Live Digilist booking writes still need Digilist tenant context when `DATA_MODE=live`. Demo mode uses the local demo store after approval.

Admin insights are aggregated in the Express BFF. The live booking list is filtered on `startTime`, so overlapping reservations that started more than 36 hours before the period can be missed. `coverage: "truncated"` means the page cap was hit and totals are a lower bound. Demo uses the same formulas on the full SQLite set and is labelled demodata. Insights payloads do not include guest names, emails or `people`.

Room approval must mirror Digilist's actual booking write rule: `bookingConfig.approvalRequired || requiresApproval`. Room edits preserve the rest of `bookingConfig`. The test suite includes this compatibility case.

Authenticated `domain/bookings:create` uses the session user, env tenant, mapped `resourceId`, Oslo interval, and purpose in notes/title. The BFF stamps `metadata.moteromIdempotencyKey` so a retry of the same confirmation can replay. The portal does not fabricate Stripe sessions, card charges, invoices, email receipts or reminders. Guest REST checkout is not used for SKB.

## Boundaries to validate in staging

- All seven resources must be `listingStatus=published` (or active equivalent), `visibility=private`, `accessChannel=tenant_portal`, free to book, and owned by a dedicated SKB tenant — never a marketplace tenant. Public slug, guest checkout, embed, and storefront `listMine` must 404/omit them.
- Check room changes that trigger Digilist re-moderation. A listing that becomes marketplace-visible is a launch blocker.
- Test opening hours in Europe/Oslo, including winter/summer. The reviewed component availability implementation uses JavaScript `Date` local-time accessors for its opening-hours comparison. Confirm the deployed backend's behavior with Oslo fixtures; this portal must not paper over an upstream timezone discrepancy.
- Booking writes rely on Digilist's transactional conflict checks. Block creation performs an advisory pre-check; confirm the upstream mutation's race behavior when a booking and maintenance block are created concurrently. A frontend check alone cannot provide atomicity.
- Quotes are rechecked immediately before creation. Paid or price-on-request rooms fail closed in Møterom; they are not redirected to Digilist.
- Edit requests keep the original time reserved. Approval, repricing and final application of that request remain in Digilist's established workflow. The demo records the request for review; it does not simulate an actual invoice or approval worker.
- Verify `ADMIN_EMAILS` plus Digilist tenant role, and membership revocation, with the real test users. Backend permission checks remain authoritative even when the portal exposes an admin action.

Any required backend changes belong in the Digilist repository under `feat/tenant-portal-listings`. Do not push that branch to Digilist `dev` or `main` (those deploy). This implementation does not duplicate that production domain or silently modify it.
