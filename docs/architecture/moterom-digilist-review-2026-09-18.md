# Møterom / Digilist integration review

Date: 18 September 2026. Branch: `fix/moterom-digilist-integration`, based on Møterom `dev` at `b63529f0405f629b905075a31f650b0dcc4e02db`.

Digilist contracts inspected at development commit `13ca70d311eb2dc3a0d55ddf038e2fb781540ebe`. No Digilist source, tenant records, credentials, deployments, or live reservations were changed. This is an integration repair and capability review, not certification of the whole SaaS or a complete dashboard migration.

## Product contract

- Møterom remains its own product at `skb.digilist.no`, with its existing room grid, date/time selection, purpose and confirmation flow.
- The browser uses Møterom's Express BFF. Only the BFF calls Digilist, using the signed-in user's session and one configured building tenant.
- Digilist owns membership, resource configuration, availability, bookings, approval and conflict enforcement. There is no second live booking database.
- Rooms must belong to the configured tenant and be private `tenant_portal` resources. They must remain absent from public marketplace and mobile discovery.
- Møterom has no payment or invoicing system and must not redirect customers to Digilist checkout.
- Møterom owns its admin presentation. Existing Digilist design tokens remain unchanged. No extraction of shared dashboard packages is required for these fixes.

## Tenant evidence and deployment limits

The repository documents `skb-moterom-test` and seven private room mappings in `docs/skb-private-portal.md` and `config/rooms.json`. Digilist `dev` includes `seedSkbTestTenant.ts` and the portal-isolation work. That proves the intended setup exists in source and prior records; it does not prove which tenant the VPS currently targets.

The deployed entry page was inspected in the browser and showed Digilist email/SMS sign-in and membership-request options. Anonymous HTTP reads of `/api/rooms` and `/api/admin` returned 401. `/api/admin/members` returned 404 before this branch is deployed. `/api/config` timed out twice from the execution environment. No authenticated live session or host environment was inspected, and no OTP/SMS was requested.

Historical acceptance notes elsewhere in this repository disagree about demo/live rollout timing. Treat them as dated evidence, not current deployment confirmation. Inspect the deployed configuration with the operator before cutover; do not create another tenant merely because authenticated verification is outstanding.

## Verified defects repaired

| Defect                                                                                             | Change                                                                                                                                                                                                        | Verification                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Local access-request approval overrode Digilist membership, including the token-refresh fallback   | Removed the local grant. Live membership requires the configured tenant and a current role. Completing a request verifies an active matching Digilist membership.                                             | Mocked live HTTP tests cover local approval, upstream denial and refresh failure.                                                |
| A successful booking retry hit occupied-slot or expired-quote checks first                         | Reconcile the authenticated booking before those checks; scope its key to tenant/user and validate its request fingerprint. Recover a committed mutation after a lost response without sending another write. | Mocked live HTTP tests cover replay, changed payload, lost response, different tenant and expired quote without a prior booking. |
| Customer cancellation sent the Convex JWT to a REST endpoint that requires an opaque session token | Send the correct token, preserving booking ownership and tenant checks.                                                                                                                                       | Adapter test inspects the REST authorization header.                                                                             |
| English descriptions, capacity labels and photo provenance were accepted but lost                  | Persist portal fields under resource `metadata.moterom`, preserve other metadata/rules and reread after saving.                                                                                               | Mocked HTTP save followed by a fresh catalogue request.                                                                          |
| Phone details disappeared on later booking reads                                                   | Persist portal phone metadata and normalize it on subsequent reads.                                                                                                                                           | Retry/readback test.                                                                                                             |
| Every card slot checked all seven rooms and repeated resource enrichment                           | Scope availability to the selected room and memoize room reads within one request only.                                                                                                                       | One nine-slot request now makes one resource read and nine validators (10 calls versus 126). No cross-session cache.             |
| Tenant-switch errors were swallowed indiscriminately                                               | Tolerate only the explicit non-member error; preserve infrastructure and invalid-session failures.                                                                                                            | Adapter regression test.                                                                                                         |
| Host headers could expand the production write-origin allowlist                                    | Production accepts only `PUBLIC_ORIGIN`.                                                                                                                                                                      | Tests with forged host and wrong-scheme origins.                                                                                 |
| Live configuration could enable public access or misleading payment modes                          | Default live access to members; reject live `public`, `invoice`, or `hosted` configuration.                                                                                                                   | Configuration regression tests.                                                                                                  |
| Legacy metadata could override an explicit marketplace channel                                     | Top-level channel wins; require private visibility as well as the portal channel.                                                                                                                             | Adapter isolation tests.                                                                                                         |

Admin → Users now shows the actual tenant's active/invited membership list. Customer and anonymous access to that API is denied. Access requests remain an inbox, not a permission store. The wording explains that declining a request does not revoke membership.

Live room image editing now uses an HTTPS URL. Content-only saves preserve the existing gallery and variants. Clearing a multi-image gallery requires the Digilist gallery workflow; this form must not silently delete unrelated photos. Images are labelled illustrative until their provenance is explicitly confirmed for the selected URL. No image files or room facts were added or invented.

## Dashboard coverage

| Capability                                                                | Møterom status after this branch                                               | Remaining dependency                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Room catalogue and card booking                                           | Connected through BFF to private resources, quote and booking APIs             | Authenticated staging and deployed tenant confirmation                            |
| Personal bookings, cancellation and calendar download                     | Existing paths retained; cancellation token and retry recovery repaired        | Live end-to-end acceptance                                                        |
| Admin overview, day/week calendar, booking filters, approvals/rejections  | Existing Digilist-backed implementation retained                               | Exercise each action with tenant admin/customer accounts                          |
| Admin room content, bilingual descriptions, labels, images, approval mode | Saves through existing Digilist resource update contract                       | Browser checks and any upstream re-moderation behavior                            |
| Maintenance blocks and insights                                           | Existing tenant-scoped operations retained                                     | Simultaneous block/booking test; history coverage limits remain                   |
| Members and access requests                                               | Actual Digilist member list plus verified request completion                   | Booking-only membership provisioning/revocation contract                          |
| Opening hours, buffers, advanced room rules                               | Digilist remains the editor                                                    | Bring a scoped validated editor into Møterom after inspecting its exact contracts |
| Booking edit approval                                                     | Request submitted from Møterom; final approval/application remains in Digilist | Adapt existing edit-review APIs and permissions locally                           |
| Staff role changes and invitations                                        | Existing Digilist workflow                                                     | Do not substitute staff invitation for customer building access                   |
| Payments, invoices, marketplace, platform administration                  | Outside Møterom's product scope                                                | Preserve ordinary Digilist SaaS behavior                                          |

The entire Digilist dashboard has **not** been transplanted. In particular, members, opening hours and edit approval are not all fully administered inside Møterom yet. Avoid an iframe, cross-product token handoff, or copying unrelated platform/payment screens to disguise these gaps. Build only the needed local screens on verified tenant-scoped APIs.

## Shared-backend requirements before a launch claim

1. **Atomic no-payment policy.** The BFF rejects nonzero quotes, but Digilist `domain/bookings:create` recomputes authoritative pricing and can schedule an invoice for a positive balance. A price change between quote and commit can therefore escape a BFF-only guard. Add an opt-in tenant/resource no-payment policy enforced inside creation, approval and edit application before paid side effects. Test that normal Digilist paid bookings remain unchanged. Do not zero a price client-side or disable invoicing globally.
2. **Durable idempotency.** Recovery currently scans the latest 500 user bookings; upstream audience filtering occurs after that limit. A metadata marker is not a transactional unique index. Add an authenticated lookup and atomic unique key scoped to tenant/user, with a payload fingerprint, before claiming durable exactly-once creation across replicas, cancellation, edits or large histories. The existing transactional conflict guard still owns simultaneous slot protection.
3. **Booking-only membership.** The reviewed test seed gives members `support`; the existing team invitation API grants staff roles and sends invitations. Review that role's capabilities and define a minimal building-booker permission path before wiring an Approve access action to it. Retain tenant-admin authorization and revocation checks; do not turn users into staff to make booking work.
4. **Live isolation acceptance.** Verify all seven rooms, customer booking visibility, public slug/checkout/embed behavior, marketplace search and mobile discovery against the deployed backend. A portal-side private check cannot hide a resource from another product if its shared backend is wrong.

Any Digilist implementation must use its own review branch and comply with that repository's GitNexus impact analysis before symbol edits and change analysis before commit. GitNexus tools were not available in this workspace; Digilist was inspected read-only. No exception to those gates was taken.

## Verification and review gates

- Baseline on Node 24.19.0: 64 tests passed; typecheck and production build passed.
- Updated suite: 82 tests passed across 14 files; typecheck and production build passed. This includes demo HTTP, unit and mocked live-mode HTTP tests. It is not a live concurrency test.
- `npm run format:check` and `git diff --check` passed.
- Vite still reports the pre-existing large main chunk warning; no dependency or bundling overhaul was attempted.
- The cloud browser blocked `http://localhost:4173` with `ERR_BLOCKED_BY_CLIENT`. Changed UI, keyboard, mobile and theme checks remain unverified. The deployed login observation does not verify the new branch.
- No credentials, live bookings, invitations, payments or member-role changes were submitted during verification.

Before merge, inspect the branch in a local/staging browser at phone and desktop widths, in both themes. Check admin room save/refresh, membership list loading/error states, request verification failure, booking retry and cancellation. Then use distinct admin/member/outsider/revoked staging users to run the acceptance list, including two concurrent booking attempts and a booking/block race. Exactly one accepted reservation must own a conflicting interval.

Do not merge or deploy this branch as a claim that the full dashboard or launch work is complete. Review the isolated repairs first and keep the shared-backend requirements visible.
