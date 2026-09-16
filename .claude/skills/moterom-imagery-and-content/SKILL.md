---
name: moterom-imagery-and-content
description: Add or change Møterom room images and Norwegian product copy without inventing building facts. Use when editing photographs, captions, rooms.json, or user-facing text.
---

# Møterom imagery and content

Prefer verified actual room assets. Label anything else as illustration.

## Required inputs

- `config/rooms.json` and `shared/types.ts` (`image`, `imageKind`)
- `docs/room-images.md` for provenance
- `assets/README.md` for the private floor plan
- Existing image wells in `RoomPhoto`, `RoomCard`, and room detail

## Procedure

1. Prefer a Digilist HTTPS room image (`imageKind: "actual"`) over a local file.
2. If using illustration, verify the license, store a compressed file under `public/rooms/`, and record source, photographer, date, and kind in `docs/room-images.md`.
3. Keep **Illustrasjonsfoto** / **Illustrative photo** (via i18n) visible whenever `imageKind` is not `actual`.
4. Keep current card/detail proportions (`--ds-size-card-image-*`). Add `loading="lazy"`, stable width/height, and a placeholder on error.
5. Write concise Norwegian Bokmål and matching English for curated room `description` / `descriptionEn` (and capacity labels). Do not invent equipment, accessibility, prices, addresses, or Eidefossen names. Room proper names stay untranslated.
6. Never commit a building floor plan; use `FLOORPLAN_PATH`.

## Non-negotiable

- Do not present illustration as a photo of this building
- Do not fill space with unrelated stock
- Card images that duplicate the heading stay decorative (`alt=""`); detail images that convey the room use meaningful alt text

## Acceptance

- Each new image has a provenance row
- Live actual photos still override illustrative fallbacks
- Copy matches confirmed inventory only

## Evidence

List files added, license, actual vs illustrative, and any copy that was intentionally left generic.
