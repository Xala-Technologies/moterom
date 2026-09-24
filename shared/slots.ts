import type { TimeSlot } from "./types";

export type SlotInterval = { start: string; end: string };

/** Whether every one-hour chip covering [start, end) is available and contiguous. */
export function rangeIsAvailable(
  slots: TimeSlot[],
  start: string,
  end: string,
): boolean {
  if (end <= start) return false;
  const covering = slots
    .filter((slot) => slot.start >= start && slot.end <= end)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!covering.length) return false;
  if (covering[0]!.start !== start || covering.at(-1)!.end !== end)
    return false;
  for (let i = 0; i < covering.length; i++) {
    if (covering[i]!.state !== "available") return false;
    if (i > 0 && covering[i]!.start !== covering[i - 1]!.end) return false;
  }
  return true;
}

export function slotInRange(
  slot: Pick<TimeSlot, "start" | "end">,
  range: SlotInterval,
): boolean {
  return slot.start >= range.start && slot.end <= range.end;
}

/**
 * Contiguous multi-hour selection on one-hour chips:
 * - empty → select clicked hour
 * - click inside current range → clear
 * - click outside → expand to min–max if every hour in between is available, else replace
 */
export function nextSlotSelection(
  slots: TimeSlot[],
  current: SlotInterval | null,
  clicked: Pick<TimeSlot, "start" | "end">,
): SlotInterval | null {
  if (current && slotInRange(clicked, current)) return null;
  if (!current) return { start: clicked.start, end: clicked.end };
  const start = clicked.start < current.start ? clicked.start : current.start;
  const end = clicked.end > current.end ? clicked.end : current.end;
  if (rangeIsAvailable(slots, start, end)) return { start, end };
  return { start: clicked.start, end: clicked.end };
}
