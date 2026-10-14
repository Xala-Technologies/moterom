# FHH demo isolation checklist

Verify before the customer meeting. Two hostnames on the same VPS are not enough.

## Expected layout (Hostinger)

| Portal | Path               | Container     | Data                                         |
| ------ | ------------------ | ------------- | -------------------------------------------- |
| SKB    | `/opt/moterom`     | `moterom`     | Live Digilist + SKB env                      |
| FHH    | `/opt/moterom-fhh` | `moterom-fhh` | `DATA_MODE=demo`, own SQLite under that tree |

## Checks

1. FHH `.env` has `DATA_MODE=demo`, `ALLOW_DEMO_DEPLOYMENT=true`, `BOOKING_ACCESS=public`, `BUILDING_NAME=Frivillighetens Hus`, and a **distinct** `DEMO_DB_PATH` inside the FHH volume (e.g. `/app/.data/fhh-demo.sqlite` — not SKB’s file).
2. FHH `.env` has **no** `DIGILIST_TENANT_ID` / production write credentials used by SKB live. Digilist URL vars may exist for OTP later; demo mode must not create Digilist bookings.
3. `curl -s https://fhh.digilist.no/api/config` → `mode=demo`, `access=public`.
4. `curl -s https://skb.digilist.no/api/config` → `mode=live`, `access=members`, SKB building name.
5. Create a demo booking on FHH; it must **not** appear in SKB admin or Digilist production.
6. Rebuild only `moterom-fhh`. Do not rebuild the SKB image from `feat/frivillighetens-hus`.

## Local

```sh
DATA_MODE=demo
DEMO_DB_PATH=.data/fhh-demo.sqlite
BOOKING_ACCESS=public
BUILDING_NAME=Frivillighetens Hus
ALLOW_DEMO_DEPLOYMENT=true
```

Keep SKB on a separate checkout or env with its own `DEMO_DB_PATH` / live tenant.
