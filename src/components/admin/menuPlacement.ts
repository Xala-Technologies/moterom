export type MenuPlacement = "down" | "up";

/** Extra room in the viewport before a downward menu is allowed. */
const VIEWPORT_MARGIN = 48;
/** Keep the page's bottom padding intact when opening downward. */
const PAGE_MARGIN = 24;
/** Minimum usable room above when flipping upward. */
const ABOVE_MIN = 72;

/** Choose up when a downward menu would sit tight against the viewport or page end. */
export function menuPlacementFor(
  trigger: DOMRect,
  menuHeight: number,
): MenuPlacement {
  const spaceBelowViewport = window.innerHeight - trigger.bottom;
  const spaceAbove = trigger.top;
  const spaceBelowPage =
    document.documentElement.scrollHeight - (window.scrollY + trigger.bottom);
  const comfortableBelow =
    spaceBelowViewport >= menuHeight + VIEWPORT_MARGIN &&
    spaceBelowPage >= menuHeight + PAGE_MARGIN;
  const canOpenUp = spaceAbove >= Math.min(menuHeight, ABOVE_MIN);
  return !comfortableBelow && canOpenUp ? "up" : "down";
}
