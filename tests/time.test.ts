import { describe, expect, it } from "vitest";
import {
  nextSlotSelection,
  rangeIsAvailable,
  slotInRange,
} from "../shared/slots";
import {
  interval,
  overlaps,
  osloDayRange,
  suggestedSlots,
} from "../shared/time";
import type { TimeSlot } from "../shared/types";

/** Index 0 = 08:00–09:00 … index 8 = 16:00–17:00. Unlisted indexes are available. */
function hours(
  blocked: Partial<Record<number, TimeSlot["state"]>> = {},
): TimeSlot[] {
  return suggestedSlots().map((slot, i) => ({
    ...slot,
    state: blocked[i] ?? "available",
  }));
}

describe("Oslo booking intervals", () => {
  it("uses the correct offset in winter and summer", () => {
    expect(
      new Date(
        interval({ date: "2027-01-15", start: "09:00", end: "10:00" })
          .startTime,
      ).toISOString(),
    ).toBe("2027-01-15T08:00:00.000Z");
    expect(
      new Date(
        interval({ date: "2027-07-15", start: "09:00", end: "10:00" })
          .startTime,
      ).toISOString(),
    ).toBe("2027-07-15T07:00:00.000Z");
  });
  it("rejects nonexistent and ambiguous local times", () => {
    for (const date of ["2026-03-29", "2026-10-25"])
      expect(() => interval({ date, start: "02:30", end: "03:30" })).toThrow();
  });
  it("requires the end to follow the start", () => {
    expect(() =>
      interval({ date: "2027-01-15", start: "10:00", end: "09:00" }),
    ).toThrow();
  });
  it("suggests one-hour slots from 08:00 to 17:00", () => {
    expect(suggestedSlots()[0]).toEqual({ start: "08:00", end: "09:00" });
    expect(suggestedSlots().at(-1)).toEqual({ start: "16:00", end: "17:00" });
    expect(suggestedSlots()).toHaveLength(9);
  });
  it("allows adjacent reservations but detects partial overlap", () => {
    const a = { startTime: 10, endTime: 20 };
    expect(overlaps(a, { startTime: 20, endTime: 30 })).toBe(false);
    expect(overlaps(a, { startTime: 19, endTime: 30 })).toBe(true);
    expect(overlaps(a, { startTime: 5, endTime: 11 })).toBe(true);
  });
  it("builds half-open Oslo day ranges at the winter and summer offsets", () => {
    const winter = osloDayRange("2027-01-15", "2027-01-16");
    expect(new Date(winter.startTime).toISOString()).toBe(
      "2027-01-14T23:00:00.000Z",
    );
    expect(new Date(winter.endTime).toISOString()).toBe(
      "2027-01-15T23:00:00.000Z",
    );
    const summer = osloDayRange("2027-07-15", "2027-07-16");
    expect(new Date(summer.startTime).toISOString()).toBe(
      "2027-07-14T22:00:00.000Z",
    );
  });
});

describe("contiguous hour-slot selection", () => {
  it("treats a range as available only when every covering hour is free", () => {
    const slots = hours({ 3: "unavailable" }); // 11:00–12:00 busy
    expect(rangeIsAvailable(slots, "09:00", "11:00")).toBe(true);
    expect(rangeIsAvailable(slots, "09:00", "12:00")).toBe(false);
    expect(rangeIsAvailable(slots, "12:00", "14:00")).toBe(true);
    expect(rangeIsAvailable(slots, "10:00", "10:00")).toBe(false);
  });

  it("marks chips inside the selected interval", () => {
    const range = { start: "10:00", end: "13:00" };
    expect(slotInRange({ start: "10:00", end: "11:00" }, range)).toBe(true);
    expect(slotInRange({ start: "12:00", end: "13:00" }, range)).toBe(true);
    expect(slotInRange({ start: "09:00", end: "10:00" }, range)).toBe(false);
    expect(slotInRange({ start: "13:00", end: "14:00" }, range)).toBe(false);
  });

  it("selects, expands, clears, and replaces when a middle hour is blocked", () => {
    const free = hours();
    expect(
      nextSlotSelection(free, null, { start: "10:00", end: "11:00" }),
    ).toEqual({
      start: "10:00",
      end: "11:00",
    });
    expect(
      nextSlotSelection(
        free,
        { start: "10:00", end: "11:00" },
        { start: "12:00", end: "13:00" },
      ),
    ).toEqual({ start: "10:00", end: "13:00" });
    expect(
      nextSlotSelection(
        free,
        { start: "10:00", end: "13:00" },
        { start: "09:00", end: "10:00" },
      ),
    ).toEqual({ start: "09:00", end: "13:00" });
    expect(
      nextSlotSelection(
        free,
        { start: "10:00", end: "13:00" },
        { start: "11:00", end: "12:00" },
      ),
    ).toBeNull();
    const blocked = hours({ 3: "unavailable" }); // 11:00–12:00
    expect(
      nextSlotSelection(
        blocked,
        { start: "10:00", end: "11:00" },
        { start: "12:00", end: "13:00" },
      ),
    ).toEqual({ start: "12:00", end: "13:00" });
  });
});
