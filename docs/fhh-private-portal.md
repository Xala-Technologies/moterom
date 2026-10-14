# Frivillighetens Hus — private portal

This branch is the Møterom portal for Frivillighetens Hus. Production origin is `https://fhh.digilist.no`. Digilist remains the booking authority. Isolation follows [`multi-tenant-portals.md`](multi-tenant-portals.md): one Digilist tenant, private `tenant_portal` rooms, no marketplace listing.

SKB stays on its own deployment and `config/rooms.json` on `dev`/`main`. Do not merge this inventory back onto SKB.

## What is decided

| Item          | Value                                         | Status                          |
| ------------- | --------------------------------------------- | ------------------------------- |
| Hostname      | `fhh.digilist.no`                             | Chosen                          |
| Portal        | Møterom BFF + UI, same as SKB                 | This branch                     |
| Access        | `BOOKING_ACCESS=members`                      | Same rule as other live portals |
| Payment       | Unset. Paid Digilist quotes still fail closed | Until price rules exist         |
| Building name | `Frivillighetens Hus`                         | Set via `BUILDING_NAME`         |

## What is not decided

Do not invent these in env, Digilist, or `config/rooms.json`:

- Digilist tenant id
- Confirmed room capacities, equipment, photos, opening hours
- Building address and contact email
- Admin emails
- Whether Styrerommet or Syerommet is the correct fifth meeting-room name
- Zone graph for Sal 1–3 and Bakgården
- Price groups and cancellation rules

Ingvild’s specification lists Elvebredden, Biblioteket, Salongen, Spisestuen and Styrerommet, plus Sal 1–3 and Bakgården. The 13 October 2026 meeting used Syerommet instead of Styrerommet. This catalogue uses **Styrerommet** with `nameNeedsConfirmation`. Sal 1–2 and Sal 1–3 are not separate bookable rows until the booking engine can block overlapping zones.

## Room seed (portal ids)

Stable portal `id`s stay in this repository. Digilist slugs are placeholders until the DEV tenant exists. Do not replace `id` with a guessed Convex id.

| Portal id   | Name        | Slug (to create)  | Capacity | Notes                                              |
| ----------- | ----------- | ----------------- | -------- | -------------------------------------------------- |
| elvebredden | Elvebredden | `fhh-elvebredden` | unknown  | Price example in the meeting was illustrative only |
| biblioteket | Biblioteket | `fhh-biblioteket` | unknown  |                                                    |
| salongen    | Salongen    | `fhh-salongen`    | unknown  |                                                    |
| spisestuen  | Spisestuen  | `fhh-spisestuen`  | unknown  |                                                    |
| styrerommet | Styrerommet | `fhh-styrerommet` | unknown  | Confirm name vs Syerommet                          |
| sal-1       | Sal 1       | `fhh-sal-1`       | unknown  | Combinations not enforced                          |
| sal-2       | Sal 2       | `fhh-sal-2`       | unknown  | Combinations not enforced                          |
| sal-3       | Sal 3       | `fhh-sal-3`       | unknown  | Combinations not enforced                          |
| bakgarden   | Bakgården   | `fhh-bakgarden`   | unknown  | Should be internal-only; not gated yet             |

`capacity: 1` in `config/rooms.json` is a schema minimum so demo booking tests can run. The labels say capacity is unconfirmed. Do not treat 1 as the real room size. No photos are attached; do not reuse SKB illustrations as this building.

## Deploy env (when a Digilist tenant exists)

```sh
DATA_MODE=live
PUBLIC_ORIGIN=https://fhh.digilist.no
BOOKING_ACCESS=members
BUILDING_NAME=Frivillighetens Hus
DIGILIST_URL=https://convex-api.dev.digilist.no
DIGILIST_HTTP_URL=https://convex.dev.digilist.no
DIGILIST_TENANT_ID=
ADMIN_EMAILS=
SESSION_SECRET=
```

Leave `PAYMENT_MODE` and `ALLOW_DEMO_DEPLOYMENT` unset on the customer host. Add `https://fhh.digilist.no` to Digilist `EXTRA_CORS_ORIGINS` only as an approved env change.

Local demo can run without a tenant:

```sh
DATA_MODE=demo
PUBLIC_ORIGIN=http://localhost:4173
BUILDING_NAME=Frivillighetens Hus
```

## Hostname status (14 October 2026)

Checked from this machine:

| Host              | DNS                             | HTTP                    |
| ----------------- | ------------------------------- | ----------------------- |
| `skb.digilist.no` | A `31.97.77.81`                 | 200, Caddy, `mode=live` |
| `fhh.digilist.no` | no A/CNAME (SOA at one.com)     | does not resolve        |
| `digilist.no` NS  | `ns01.one.com` / `ns02.one.com` |                         |

`fhh.digilist.no` is not up. The Motereom VPS is the SKB box at `31.97.77.81`. The Digilist VPS at `72.61.23.56` is a different machine. Do not point this branch at the SKB container; that would replace SKB rooms.

To get the hostname answering:

1. In one.com DNS for `digilist.no`, add `fhh` A → `31.97.77.81` (same as `skb`).
2. On that VPS, add a Caddy site for `fhh.digilist.no` and a **second** Møterom container built from `feat/frivillighetens-hus`.
3. Until a Digilist tenant exists, that container can run demo (`DATA_MODE=demo` and `ALLOW_DEMO_DEPLOYMENT=true`) so the URL loads. Switch to live and drop the demo flag when the tenant exists. Do not leave demo on after go-live.

SSH from this laptop to `31.97.77.81` with `~/.ssh/digilist_deploy` was refused (`publickey`). Deploy needs the Motereom VPS key or a one.com + Hostinger session.

## Rollout order

1. DNS + Caddy + FHH container so `https://fhh.digilist.no` answers.
2. Create an isolated Digilist DEV tenant (not marketplace, not SKB).
3. Create the nine rooms as `visibility=private`, `accessChannel=tenant_portal`. Confirm whether they stay free for an internal pilot or get real prices. Paid quotes still fail in this BFF.
4. Put the real tenant id in `DIGILIST_TENANT_ID` and the bootstrap admin in `ADMIN_EMAILS`.
5. Confirm names, capacities, photos and address from the customer before calling the catalogue finished.
6. Flip the FHH container to live. Do not rebuild the SKB image with this branch.

Function gaps (zones, four price groups, catering, Service Crew) are recorded in [`frivillighetens-hus-funksjonsmatrise.md`](frivillighetens-hus-funksjonsmatrise.md).
