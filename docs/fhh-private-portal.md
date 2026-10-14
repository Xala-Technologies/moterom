# Frivillighetens Hus — private portal

This branch is the Møterom portal for Frivillighetens Hus. Production origin is `https://fhh.digilist.no`. Digilist remains the booking authority. Isolation follows [`multi-tenant-portals.md`](multi-tenant-portals.md): one Digilist tenant, private `tenant_portal` rooms, no marketplace listing.

SKB stays on its own deployment and `config/rooms.json` on `dev`/`main`. Do not merge this inventory back onto SKB.

## What is decided

| Item          | Value                                         | Status                                         |
| ------------- | --------------------------------------------- | ---------------------------------------------- |
| Hostname      | `fhh.digilist.no`                             | Chosen                                         |
| Portal        | Møterom BFF + UI, same as SKB                 | This branch                                    |
| Access        | Demo: `BOOKING_ACCESS=public`. Live TBD       | Demo catalogue is open; login before confirm   |
| Payment       | Demo records illustrative totals; live unpaid | Paid Digilist quotes still fail closed in live |
| Building name | `Frivillighetens Hus`                         | Set via `BUILDING_NAME`                        |

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
| bakgarden   | Bakgården   | `fhh-bakgarden`   | unknown  | `internalOnly` in demo (server-enforced)           |

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

Local / Hostinger demo (current `fhh.digilist.no`):

```sh
DATA_MODE=demo
ALLOW_DEMO_DEPLOYMENT=true
BOOKING_ACCESS=public
PUBLIC_ORIGIN=https://fhh.digilist.no
BUILDING_NAME=Frivillighetens Hus
DEMO_DB_PATH=/opt/moterom-fhh/data/demo.sqlite
```

See [fhh-demo-isolation.md](fhh-demo-isolation.md) and [fhh-demo-walkthrough.md](fhh-demo-walkthrough.md).

## Hostname status (14 October 2026)

| Host              | DNS             | HTTP                                                  |
| ----------------- | --------------- | ----------------------------------------------------- |
| `skb.digilist.no` | A `31.97.77.81` | 200, Caddy TLS, `mode=live` (container `moterom`)     |
| `fhh.digilist.no` | A `31.97.77.81` | 200, Caddy TLS, `mode=demo` (container `moterom-fhh`) |

Both portals share Hostinger VPS `srv1154093` / `31.97.77.81`. SKB stays in `/opt/moterom`. FHH is `/opt/moterom-fhh` from branch `feat/frivillighetens-hus`. Do not rebuild the SKB image with this branch.

FHH is on **demo** until a Digilist tenant, rooms and `ADMIN_EMAILS` exist. Then edit `/opt/moterom-fhh/.env` to live, unset `ALLOW_DEMO_DEPLOYMENT`, set tenant URLs and ids, and rebuild.

## Rollout order

1. DNS + Caddy + FHH container — done (`https://fhh.digilist.no` answers in demo).
2. Create an isolated Digilist DEV tenant (not marketplace, not SKB).
3. Create the nine rooms as `visibility=private`, `accessChannel=tenant_portal`. Confirm whether they stay free for an internal pilot or get real prices. Paid quotes still fail in this BFF.
4. Put the real tenant id in `DIGILIST_TENANT_ID` and the bootstrap admin in `ADMIN_EMAILS`.
5. Confirm names, capacities, photos and address from the customer before calling the catalogue finished.
6. Flip the FHH container to live. Do not rebuild the SKB image with this branch.

Function gaps (zones, four price groups, catering, Service Crew) are recorded in [`frivillighetens-hus-funksjonsmatrise.md`](frivillighetens-hus-funksjonsmatrise.md).
