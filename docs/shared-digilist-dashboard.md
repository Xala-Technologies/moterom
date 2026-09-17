# Digilist-inspired admin UI in Møterom

Status: Møterom owns its admin presentation. Digilist is the booking backend only.

## Rule

Do **not** change Digilist source, extract Digilist dashboard packages, or vendor Digilist UI tarballs for Møterom. Digilist remains a multi-tenant SaaS used by other applications. Møterom must not create Digilist PRs for presentation sharing.

## Architecture

```text
Møterom Admin UI  →  Express BFF  →  Digilist REST / Convex
```

- Public booking journey, admin navigation, nb/en, and Express stay in Møterom.
- Digilist remains the live booking authority for create/approve/reject/cancel/blocks.
- Admin list and calendar UX may **look** Digilist-like using tokens already vendored under `src/design/digilist/`.
- Presentation components live under `src/components/admin/` and `src/pages/Admin.tsx`.

## What was reused (patterns only)

| Need               | Approach                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| Dense booking rows | Local `AdminBookingList` / `AdminBookingRowView`                        |
| Approve / reject   | Existing `/api/bookings/:id/approve` and `/reject`                      |
| Payment honesty    | Outstanding only when `paymentRequired`; never invent “paid” from price |
| Image provenance   | Room `image` / `imageKind` from Møterom config                          |
| Visual language    | Digilist CSS tokens already in the app                                  |

## Explicit non-goals

- No Digilist commits, packages, or GitNexus refactors for Møterom
- No browser connection from Møterom to Convex
- No shared npm package between Digilist and Møterom for admin UI
- Calendar can be polished in Møterom later without Digilist extraction

## Verification

- Digilist tree left on `origin/dev` with no Møterom-driven feature branch
- Møterom `npm run check` and `npm run format:check`
