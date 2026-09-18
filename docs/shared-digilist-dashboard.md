# Digilist dashboard as Møterom admin foundation

Status: Møterom rebuilds the tenant-admin experience against its Express BFF. Digilist remains the booking and membership backend. Digilist source is read-only for this programme.

## Decisions (18 September 2026)

1. **Do not copy Digilist dashboard source into Møterom.** Digilist is a private `UNLICENSED` repository; Møterom is public. Vendored files stay limited to the theme tokens already recorded in [`design-source.md`](design-source.md). Dashboard screens are a visual and information-architecture specification, reimplemented with Digdir, existing tokens, and `src/components/`.
2. **Do not call `domain/tenantTeam:inviteMember` from Møterom yet.** That mutation grants Digilist staff roles, hard-codes `appId: "backoffice"`, and emails a magic link to `{appOrigin}/auth/magic-link`. Møterom has no magic-link consumer, and a booking-only membership contract does not exist. Live access still requires an **active** Digilist tenant role on `DIGILIST_TENANT_ID`. The Users inbox verifies that membership; it does not grant it.
3. **Live adapter work from `fix/moterom-digilist-integration` is the baseline** on this branch (membership source of truth, booking retry, members list). Presentation continues in Møterom.

Visual spec version (Digilist, read-only): `feat/tenant-portal-listings` @ `e8226e0d4db2fc6a3f71c168f62f0a61065ce4cf`.

## Architecture

```text
Møterom Admin UI  →  same-origin Express BFF  →  Digilist REST / Convex
```

- The browser never talks to Convex.
- Identity, tenant membership, rooms, availability, bookings, and conflicts stay in Digilist.
- Møterom-only data is the access-request inbox (existing SQLite) and `config/rooms.json`.
- No payments, invoices, checkout, or payment settings.

## What to rebuild vs exclude

| Screen       | In Møterom                                       | Digilist analogue        | Exclude                                       |
| ------------ | ------------------------------------------------ | ------------------------ | --------------------------------------------- |
| Overview     | `/admin` stats, programme, embedded day calendar | `/` `DashboardPage`      | Onboarding, Bli utleier, revenue              |
| Calendar     | `/admin/calendar` day/7-day (month later)        | `/tenant/calendar`       | Wallet chrome, platform-global calendar       |
| Bookings     | `/admin/bookings` list, approve/reject           | `/tenant/bookings`       | Payment filters, invoices, refunds            |
| Rooms        | `/admin/rooms` content for seven portal rooms    | `/tenant/listings`       | Create listing, marketplace, pricing          |
| Members      | `/admin/users` read-only Digilist roster         | `/tenant/team`           | Role change, staff invite until a booker API  |
| Access inbox | `/admin/users` local requests                    | none                     | Treating local approve as Digilist membership |
| Insights     | `/admin/innsikt` occupancy aggregates            | `/tenant/innsikt`        | Revenue, CRM                                  |
| Settings     | Building + members-only flag                     | `/account` minus billing | Payouts, subscription, Stripe, embed          |

## Future Digilist work (separate repo, GitNexus required)

A booking-only membership mutation, magic-link `appId` that can return to `PUBLIC_ORIGIN`, and an atomic no-payment policy on `domain/bookings:create`. None of that is implemented here.

## Verification

- Digilist tree is not modified by this branch.
- Møterom `npm run check` and `npm run format:check`.
