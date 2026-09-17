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
| Published rooms              | Convex `domain/resources:getBySlugPublic`                                                                                                                                                           |
| Whole-interval availability  | Convex `domain/bookings:validateBookingSlot`                                                                                                                                                        |
| Authoritative quote          | Convex `domain/pricing:quote`                                                                                                                                                                       |
| Idempotent creation          | REST `POST /api/v1/checkout/sessions`                                                                                                                                                               |
| Customer bookings            | Convex `domain/bookings:listMine`, `domain/bookings:get`                                                                                                                                            |
| Customer cancellation        | REST `POST /api/v1/me/bookings/:id/cancel`                                                                                                                                                          |
| Change request               | Convex `domain/bookings:requestBookingEdit`                                                                                                                                                         |
| Admin bookings               | Convex `domain/bookings:list`, `approve`, `reject`, `cancel`                                                                                                                                        |
| Admin insights (Møterom BFF) | `GET /api/admin/insights` aggregates `domain/bookings:list` with `startAfter`/`startBefore`, a 36-hour lookback, internal paging, and a completeness flag. This is not Digilist `domain/analytics`. |
| Room content                 | Convex `domain/resources:update`                                                                                                                                                                    |
| Maintenance blocks           | Convex `domain/blocks:list`, `checkAvailability`, `create`, `remove`                                                                                                                                |

The BFF restricts all resources to seven configured slugs and verifies their tenant IDs. Read models sent to the client are normalized; raw user, moderation and backend metadata are not passed through. Customer booking reads are restricted to the authenticated owner. Admin list/block reads require a freshly verified member/admin of the configured tenant before calling the underlying facade.

### Building administrators

Admin access is Digilist-only. There is no separate Møterom admin password or email allowlist.

1. In Digilist, grant the person an admin-capable role on the building tenant (`DIGILIST_TENANT_ID`): platform `role` of `admin`, or `tenantRole` of `owner`, `admin`, `tenant_admin`, `saksbehandler`, or `manager`.
2. They sign in on Møterom with the same Digilist email OTP, SMS OTP, or BankID used by customers.
3. After `switchTenant` and `GET /auth/me`, the BFF sets `isAdmin` and redirects them to `/admin`.

Customers without those Digilist tenant roles land on Mine bookinger and receive 403 on `/api/admin`.

Admin insights are aggregated in the Express BFF. The live booking list is filtered on `startTime`, so overlapping reservations that started more than 36 hours before the period can be missed. `coverage: "truncated"` means the page cap was hit and totals are a lower bound. Demo uses the same formulas on the full SQLite set and is labelled demodata. Insights payloads do not include guest names, emails or `people`.

Room approval must mirror Digilist's actual booking write rule: `bookingConfig.approvalRequired || requiresApproval`. Room edits preserve the rest of `bookingConfig`. The test suite includes this compatibility case.

The REST checkout accepts `listing`, ISO `start`/`end`, verified `customer`, `guestCount` and `notes`. The backend finds the customer account by their verified email. The meeting title is prefixed to notes because this endpoint has no separate title field. The portal does not fabricate Stripe sessions, card charges, invoices, email receipts or reminders.

## Boundaries to validate in staging

- All seven resources must be published. The existing guest checkout path refuses unpublished resources, even when the portal is configured as members-only. If the building requires private listings across the entire platform, extend the authenticated Digilist contract first.
- Check room changes that trigger Digilist re-moderation. A listing that becomes non-public is intentionally unavailable to the portal until it is published again.
- Test opening hours in Europe/Oslo, including winter/summer. The reviewed component availability implementation uses JavaScript `Date` local-time accessors for its opening-hours comparison. Confirm the deployed backend's behavior with Oslo fixtures; this portal must not paper over an upstream timezone discrepancy.
- Booking writes rely on Digilist's transactional conflict checks. Block creation performs an advisory pre-check; confirm the upstream mutation's race behavior when a booking and maintenance block are created concurrently. A frontend check alone cannot provide atomicity.
- Quotes are rechecked immediately before creation, but the existing checkout contract has no expected-price/version precondition. Digilist recomputes the final authoritative price. Payment is therefore handed to the established checkout flow; invoice customers must be comfortable with that policy before enabling invoice mode.
- Paid bookings need the existing Digilist web flow or a configured invoice process. A seamless paid checkout with preserved interval and SSO requires an additional backend handoff contract.
- Edit requests keep the original time reserved. Approval, repricing and final application of that request remain in Digilist's established workflow. The demo records the request for review; it does not simulate an actual invoice or approval worker.
- Verify tenant role mappings and active-membership revocation with the real test users. Backend permission checks remain authoritative even when the portal exposes an admin action.

Any required backend changes belong in the Digilist repository under its own development instructions and review process. This implementation does not duplicate that production domain or silently modify it.
