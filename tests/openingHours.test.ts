import { describe, expect, it } from "vitest";
import {
  buildPortalOpeningHours,
  clockToMinutes,
  isValidClockTime,
  weekdayWindowFromOpeningHours,
} from "../shared/openingHours";
import { roomCreateSchema } from "../shared/validation";

describe("portal opening hours", () => {
  it("builds Mon–Fri open and weekend closed", () => {
    const hours = buildPortalOpeningHours("09:00", "16:00");
    expect(hours).toHaveLength(7);
    const weekdays = hours.filter(
      (row) => row.dayIndex >= 1 && row.dayIndex <= 5,
    );
    expect(
      weekdays.every((row) => row.open === "09:00" && row.close === "16:00"),
    ).toBe(true);
    const weekend = hours.filter(
      (row) => row.dayIndex === 0 || row.dayIndex === 6,
    );
    expect(weekend.every((row) => row.isClosed)).toBe(true);
  });

  it("reads the first weekday window from Digilist hours", () => {
    expect(
      weekdayWindowFromOpeningHours(buildPortalOpeningHours("07:30", "18:00")),
    ).toEqual({ openTime: "07:30", closeTime: "18:00" });
    expect(weekdayWindowFromOpeningHours(undefined)).toBeUndefined();
  });

  it("validates clock times", () => {
    expect(isValidClockTime("08:00")).toBe(true);
    expect(isValidClockTime("24:00")).toBe(false);
    expect(clockToMinutes("09:30")).toBe(570);
  });

  it("rejects inverted open/close on create schema", () => {
    const result = roomCreateSchema.safeParse({
      name: "Test",
      capacity: 10,
      openTime: "17:00",
      closeTime: "08:00",
    });
    expect(result.success).toBe(false);
  });

  it("defaults open/close when omitted", () => {
    const parsed = roomCreateSchema.parse({
      name: "Test",
      capacity: 10,
    });
    expect(parsed.openTime).toBe("08:00");
    expect(parsed.closeTime).toBe("17:00");
  });
});
