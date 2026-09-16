---
name: moterom-design-consistency
description: Preserve Digilist typography, tokens, hierarchy, and navigation when changing Møterom frontend, styling, layout, or components. Use for CSS, React UI, cards, header, sidebar, or theme work.
---

# Møterom design consistency

Keep the approved Digilist look. Improve execution; do not restyle the product.

## Required inputs

- The screen or component being changed
- Nearby shared usage in `src/components/` and `src/styles.css`
- Vendored reference in `src/design/digilist/` (read-only)
- Both customer and admin surfaces that share the pattern
- Light and dark via `data-color-scheme`

## Procedure

1. Inspect the existing shared component and token usage before writing new markup or CSS.
2. Reuse Digdir primitives and local components (`Button`, `Field`, `Modal`, `Status`, `RoomCard`, `Shell`).
3. Put layout and product styles in `src/styles.css`. Do not edit files under `src/design/digilist/`.
4. Fix repeated inconsistencies in the shared source, not with a one-off page override.
5. Check the same pattern on customer and admin screens, and in both themes.
6. Review representative before/after at desktop and a phone width.

## Non-negotiable

- No new design system, font, palette, or navigation concept
- No marketing hero, decorative gradients, glass, or extra animation
- Do not shrink type to hide crowding
- A new visual direction is outside this task

## Acceptance

- Hierarchy, spacing, and controls still match Digilist cards, header, and sidebar
- Shared correction landed in the shared file when more than one screen needed it
- Light and dark both remain usable

## Evidence

Note which screens and theme you compared, and whether you used a screenshot or in-browser pass. If you did not look at the UI, say so.
