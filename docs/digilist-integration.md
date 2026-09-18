# Digilist integration contracts

Integration rechecked against `Xala-Technologies/Digilist` development commit `13ca70d311eb2dc3a0d55ddf038e2fb781540ebe` on 18 September 2026. These are source-reviewed contracts, not authenticated staging acceptance. See [the integration review](architecture/moterom-digilist-review-2026-09-18.md).

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
| Creation and retry recovery  | Convex `domain/bookings:create` with `metadata.moteromIdempotencyKey` namespaced `tenantId:userId:key`, plus request fingerprint; bounded replay lookup, not an atomic idempotency index            |
| Customer bookings            | Convex `domain/bookings:listMine`, `domain/bookings:get`                                                                                                                                            |
| Customer cancellation        | REST `POST /api/v1/me/bookings/:id/cancel` with the access token; `convex/http.ts` uses `requireAccessToken` for this route                                                                         |
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

Live mode requires `BOOKING_ACCESS=members`. Non-members can submit an access request to Møterom's local inbox. For signed-in requests, identity comes from the verified session. The inbox does not grant or revoke Digilist membership.

Portal access requires Digilist `/auth/me` to return the configured tenant **and a current tenant role**. Historical local approvals never override that result, including during access-token refresh failures.

Admin → **Brukere** now reads active and invited members using `domain/tenantTeam:listMembers`, scoped server-side to the building and authenticated actor. **Kontroller medlemskap** completes a request only after the adapter verifies an active, matching Digilist member. An invitation alone is insufficient. Declining a request does not revoke existing membership; revoke it in Digilist. New members may need to sign in again to establish the building session context.

Membership write operations remain in Digilist. Its reviewed `tenantTeam:inviteMember` grants staff roles and sends an invitation. Do not automatically map a room-access request to a staff role or silently send an invitation. A booking-only membership workflow needs a reviewed permission contract.

Tenant switching tolerates only Digilist's explicit `auth/forbidden_tenant` response, so a non-member can sign in to request access. Network, invalid-session and other errors remain failures.

Admin insights are aggregated in the Express BFF. The live booking list is filtered on `startTime`, so overlapping reservations that started more than 36 hours before the period can be missed. `coverage: "truncated"` means the page cap was hit and totals are a lower bound. Demo uses the same formulas on the full SQLite set and is labelled demodata. Insights payloads do not include guest names, emails or `people`.

Room approval must mirror Digilist's actual booking write rule: `bookingConfig.approvalRequired || requiresApproval`. Room edits preserve the rest of `bookingConfig` and resource metadata. English copy, capacity labels and photo provenance persist under `metadata.moterom`; arrival instructions remain under `metadata.arrivalInfo`. The adapter invalidates its request-local cache after saving. A content-only save preserves image variants and other gallery photos. Live photo editing accepts HTTPS URLs; binary uploads remain unsupported in live mode. The test suite includes this compatibility case.

Authenticated `domain/bookings:create` uses the session user, env tenant, mapped `resourceId`, Oslo interval, and purpose in notes/title. The BFF stamps `metadata.moteromIdempotencyKey` and `moteromFingerprint`. An authenticated matching replay is read before quote expiry or occupied-slot checks. Changed retry details fail with 409. The lookup scans the latest 500 user bookings and is not a durable, atomic idempotency guarantee; Digilist still owns transactional conflict protection. The portal does not fabricate Stripe sessions, card charges, invoices, email receipts or reminders. Guest REST checkout is not used for SKB.

## Boundaries to validate in staging

- All seven resources must be `listingStatus=published` (or active equivalent), `visibility=private`, `accessChannel=tenant_portal`, free to book, and owned by a dedicated SKB tenant — never a marketplace tenant. Public slug, guest checkout, embed, and storefront `listMine` must 404/omit them.
- Check room changes that trigger Digilist re-moderation. A listing that becomes marketplace-visible is a launch blocker.
- Test opening hours in Europe/Oslo, including winter/summer. The reviewed component availability implementation uses JavaScript `Date` local-time accessors for its opening-hours comparison. Confirm the deployed backend's behavior with Oslo fixtures; this portal must not paper over an upstream timezone discrepancy.
- Booking writes rely on Digilist's transactional conflict checks. Block creation performs an advisory pre-check; confirm the upstream mutation's race behavior when a booking and maintenance block are created concurrently. A frontend check alone cannot provide atomicity.
- Quotes are rechecked immediately before creation. Paid or price-on-request quotes fail closed in Møterom. Digilist recomputes pricing inside its mutation and can schedule an invoice for a positive balance. A price change between quote and mutation therefore still needs an upstream atomic no-payment policy for this tenant. Do not claim that a BFF zero-price check alone guarantees no invoice.
- Edit requests keep the original time reserved. Approval, repricing and final application of that request remain in Digilist's established workflow. The demo records the request for review; it does not simulate an actual invoice or approval worker.
- Verify `ADMIN_EMAILS` plus Digilist tenant role, and membership revocation, with the real test users. Backend permission checks remain authoritative even when the portal exposes an admin action.

Required backend changes belong on a separate Digilist review branch. Follow that repository’s impact-analysis and validation gates before editing shared functions. Do not push directly to Digilist `dev` or `main` (those deploy). This Møterom change does not modify Digilist source or deployed data.
