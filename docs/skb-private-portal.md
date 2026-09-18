# SKB private portal — DEV mapping and rollout

Møterom branch: `feat/skb-private-portal` (from `feat/adopt-room-admin` `6cd4730`, uncommitted grid/modal work kept).
Digilist branch: `feat/tenant-portal-listings` (from `origin/dev` `f5a6c8f`).

Do **not** merge either branch to git `dev`/`main` until you approve. This rollout was approved 18 September 2026: merge feature branches to `dev`/`main` for Møterom, merge Digilist isolation to Digilist `dev` (not production `main`), and switch Hostinger `skb.digilist.no` to live mode against the DEV SKB-test tenant.

On 17 September 2026 the Digilist **DEV Convex** at `convex-api.dev.digilist.no` was updated from this feature branch with `convex dev --once` (functions + schema only). Digilist git was **not** pushed to `dev`/`main`. The `dev.digilist.no` web apps may therefore lag the DEV Convex backend until a git merge.

## Isolated DEV URLs

| Variable                | DEV (this work)                               | Production (do not flip yet)                                      |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `DIGILIST_URL`          | `https://convex-api.dev.digilist.no`          | `https://convex-api.digilist.no`                                  |
| `DIGILIST_HTTP_URL`     | `https://convex.dev.digilist.no`              | `https://convex.digilist.no`                                      |
| `PUBLIC_ORIGIN`         | `http://localhost:4173`                       | `https://skb.digilist.no`                                         |
| `DATA_MODE`             | `live` only on a local/DEV BFF pointed at DEV | **live** on Hostinger as of 18 Sep 2026 (anonymous `/api/config`) |
| `BOOKING_ACCESS`        | `members`                                     | `members`                                                         |
| `PAYMENT_MODE`          | unset                                         | unset                                                             |
| `ALLOW_DEMO_DEPLOYMENT` | unset                                         | must stay false on live                                           |

## DEV tenant mapping

Created on Digilist DEV (not marketplace, not Verdal). Re-run with `node scripts/run-convex-with-env.mjs run seedSkbTestTenant:seed` (idempotent).

- Tenant slug: `skb-moterom-test`
- Tenant id: `xx7b7h1xq7tj0c2p581tzffyzn8ej4pd`
- `settings.portalOrigin`: `https://skb.digilist.no`
- Rooms: `visibility=private`, `accessChannel=tenant_portal`, free (`paymentRequired=false`, `basePrice=0`). DEV also has idempotent 0 NOK hourly `resourcePricing` rows; without them Digilist quote returns `NO_PRICING_CONFIGURED`.
- Portal `id`s stay `sauda-1`…`eidefossen-b`. Names/capacities taken from `config/rooms.json`. Photos remain illustrative.

| Portal id    | Confirmed name     | Capacity used | Digilist slug           | DEV tenant id                      | Resource id                        | Notes                         |
| ------------ | ------------------ | ------------- | ----------------------- | ---------------------------------- | ---------------------------------- | ----------------------------- |
| sauda-1      | Sauda 1            | 12            | `skb-test-sauda-1`      | `xx7b7h1xq7tj0c2p581tzffyzn8ej4pd` | `j57b3n6hgen93nxkxyhdjdxg358ej83r` | private + tenant_portal, free |
| sauda-2      | Sauda 2            | 10            | `skb-test-sauda-2`      | same                               | `j5715yzbbvmtjbs7vpv7cmdrt18eje2d` | same                          |
| tysso        | Tysso              | 24            | `skb-test-tysso`        | same                               | `j57891kwh9kybxfnxbyp05g7jd8ejnb5` | same                          |
| glomma-1     | Glomma 1           | 44            | `skb-test-glomma-1`     | same                               | `j572rctnjnmep9y8p0xzpmj9nn8ekm98` | same                          |
| glomma-2     | Glomma 2           | 26            | `skb-test-glomma-2`     | same                               | `j576enmyxfrqs4k1m974xkbab18ek2va` | same                          |
| eidefossen-a | Eidefossen · 12–14 | 12            | `skb-test-eidefossen-a` | same                               | `j57fx1w97s1h51yfhac89nyzj98ekze2` | name still needs confirmation |
| eidefossen-b | Eidefossen · 10–12 | 10            | `skb-test-eidefossen-b` | same                               | `j57f84h9y5zd675232fnqzs7rx8ejhmw` | name still needs confirmation |

Test users on that tenant (Digilist user rows; OTP login still requires a real mailbox):

| Email                            | Role         | Membership |
| -------------------------------- | ------------ | ---------- |
| `skb.admin@digilist.dev`         | tenant_admin | active     |
| `skb@digilist.no`                | tenant_admin | active     |
| `skb.member@digilist.dev`        | support      | active     |
| `wahidullah_rahmani@hotmail.com` | support      | active     |
| `skb.outsider@digilist.dev`      | —            | none       |
| `skb.revoked@digilist.dev`       | support      | removed    |

`wahidullah_rahmani@hotmail.com` is the real portal booker. The misspelling `hotmaiil.com` is not a mailbox. Hostinger **Godkjenn** does not grant this membership; it was added as an active `tenantUsers` row on DEV tenant `skb-moterom-test` (`support`), not via `inviteMember`.

## Production rollout (requires explicit approval)

1. Merge Digilist `feat/tenant-portal-listings` → `dev` only after DEV tenant checks pass, then `dev` → `main` only after you approve a production deploy.
2. Add `https://skb.digilist.no` to Digilist `EXTRA_CORS_ORIGINS` (approved env change, not a silent prod edit).
3. Create/verify the **production** SKB tenant and seven private tenant_portal rooms. Map slugs into `config/rooms.json`.
4. Rebuild Møterom with `DATA_MODE=live`, DEV/prod URLs matching the target, `DIGILIST_TENANT_ID`, `PUBLIC_ORIGIN=https://skb.digilist.no`, `ADMIN_EMAILS`, `BOOKING_ACCESS=members`. Do not set `PAYMENT_MODE` or `ALLOW_DEMO_DEPLOYMENT`.
5. Replace the Hostinger demo container only after a local/DEV live check against the isolated tenant.

## Rollback

- Hostinger: restore the previous Caddy/container and the `DATA_MODE=demo` image.
- Digilist git: revert `feat/tenant-portal-listings` on that feature branch. It must not reach git `dev`/`main` unless you approved that merge. Missing `accessChannel` continues to mean `marketplace`.
- Digilist DEV Convex: restore previous functions by running `convex dev --once` from git `dev` (`f5a6c8f`) if you need the `dev.digilist.no` backend to match git `dev` again. The SKB-test tenant can stay; private + tenant_portal rooms stay hidden from marketplace even after a function rollback that treats unknown `accessChannel` as marketplace **if visibility stays private**.

## Isolation checks on the DEV tenant (17 September 2026)

Against Digilist DEV after the Convex function push + seed (not Hostinger, not production Convex):

- `domain/resources:getBySlugPublic` `{ slug: "skb-test-sauda-1" }` → `null`.
- `GET https://convex.dev.digilist.no/api/v1/listings` 200 — no `skb-test-*` slugs in the page.
- `GET /api/v1/listings/skb-test-sauda-1` 404 `No public listing with slug 'skb-test-sauda-1'`.
- `GET /api/v1/listings/featured` does not mention `skb-test`.
- `GET /api/v1/listings/xala-test-konferanserom` 200 (marketplace listing still public).
- `POST /api/v1/checkout/sessions` with `listing: skb-test-sauda-1` 404 `No listing 'skb-test-sauda-1'`.

Re-checked 18 September 2026 (anonymous, no writes to tenants): all seven `skb-test-*` public slugs 404; listings page and featured omit `skb-test`; marketplace `xala-test-konferanserom` still 200. Checkout with only `{ listing }` now returns 400 (start/end required); the same route with ISO start/end and a dummy guest still 404 `No listing 'skb-test-sauda-1'`. Hostinger `skb.digilist.no` `/api/config` is `mode=live`, `access=members` (deployed image is not `feat/digilist-admin-foundation`; `/api/admin/members` 404).

Live OTP 18 September 2026 on Hostinger only: `skb@digilist.no` reached `/admin` as `isAdmin`. All seven rooms render. Insights reports live + complete coverage with 0 bookings. `/api/admin/members` remains 404. No booking was created.

Live member 18 September 2026 on Hostinger: `wahidullah_rahmani@hotmail.com` (Digilist OTP already in session; not `hotmaiil.com`) became `isMember` after the DEV tenant membership was written. `/` shows Finn rom with seven rooms. `skb.member@digilist.dev` was not used.

Live member booking 18 September 2026 on this branch only (`DATA_MODE=live`, `http://localhost:4173`): Wahid Rahmani booked Sauda 1, 18 Sep 2026 16:00–17:00, Teammøte, **Ingen betaling**. Digilist id `js7fzc258aqewx31gwbvf6rv758em29r`, status `confirmed`, reference `DGL-20260918-J77NNF`. Mine bookinger and booking detail showed the same reservation. Customer `GET /api/admin` 403 `admin_required`. Rooms needed 0 NOK hourly `resourcePricing` on DEV before quote succeeded; missing rate cards returned Digilist `NO_PRICING_CONFIGURED`. Hostinger was not used for this booking.

Not run: outsider access-pending; idempotent retry; conflict; cancel vs availability.

Covered by Digilist unit tests on `feat/tenant-portal-listings` (163 tests): marketplace default; private and `tenant_portal` public slug 404; guest create against private/`tenant_portal` rejected; storefront `listMine` omits `tenant_portal`.

Covered by Møterom unit tests (55 tests): authenticated `getBySlug`, marketplace/paid quote refuse, `domain/bookings:create`, admin = allowlist AND tenant role.

## Local demo browser (17 September 2026, Chromium in Cursor)

Local `DATA_MODE=demo` at `http://localhost:4173` as Kari Nordmann. This is **not** live Digilist.

- Grid: seven room cards; compact date + timetable; available/unavailable/selected slots; nested slot click stayed on `/`.
- Confirm modal: Sauda 1, fredag 18. september 2026, 08:00–09:00, total **Ingen betaling**, purpose Teammøte. No `app.digilist.no` / hosted redirect. Confirmed `DEMO-EEAE0C4C` on the same origin.
- Mine bookinger: upcoming Sauda 1 / Teammøte; customer “Åpne Digilist” dashboard link removed. Booking links stayed on localhost.
- Customer `/admin`: “Denne siden er for administratorer”; `GET /api/admin` 403 `admin_required`.
- Phone viewport 390×844: seven cards, `scrollWidth` 390 (no overflow), mobile nav, no `digilist.no` links on the rooms page.

Not claimed: outsider pending on DEV, marketplace leak against deployed Convex, physical device, Hostinger serving this branch, production `skb.digilist.no` booking.
