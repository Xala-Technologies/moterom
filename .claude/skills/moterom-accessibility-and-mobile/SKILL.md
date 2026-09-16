---
name: moterom-accessibility-and-mobile
description: Check keyboard, focus, labels, announcements, touch, overflow, and both themes when changing Møterom navigation, forms, calendars, dialogs, or responsive layout.
---

# Møterom accessibility and mobile

WCAG 2.2 AA is the engineering target. Do not claim full compliance without assessment.

## Required inputs

- The control or layout you changed
- `src/components/ui.tsx` (`Modal`, fields, status)
- `src/components/Shell.tsx` (header, skip link, bottom nav)
- `src/design/digilist/touch-targets.css` and `src/styles.css`
- Viewports 360, 390, 768, 1024, and 1440

## Procedure

1. Complete the journey with the keyboard. Focus must be visible and move predictably.
2. Dialogs: contain focus while open, restore it to the opener on close.
3. Inputs need a visible label; errors must be associated and announced (`role="alert"` / `role="status"` as already used).
4. Do not communicate status by colour alone (`Status` text remains).
5. Check touch targets, safe-area padding, bottom nav overlap, on-screen keyboard, and 200% zoom.
6. Confirm no unintended horizontal page scroll and that calendars/dialogs scroll inside themselves.
7. Verify light and dark. Honour `prefers-reduced-motion` already in Digilist base CSS.

## Non-negotiable

- Bottom navigation must not cover primary actions
- Do not shrink text to fit a phone layout
- Report untested browsers and assistive technology honestly

## Acceptance

- Keyboard users can finish the changed journey
- Phone layout keeps actions reachable
- Both themes remain readable

## Evidence

List viewports and theme checked, and whether keyboard or a screen reader was used. If browser tools were unavailable, say which checks remain.
