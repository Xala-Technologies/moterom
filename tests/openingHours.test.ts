import { describe, expect, it } from "vitest";
import {
  buildDigilistOpeningHours,
  buildPortalOpeningHours,
  clockToMinutes,
  digilistEngineOpenTime,
  isValidClockTime,
  isWithinWeekdayClockWindow,
  normalizeClockTime,
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

  it("normalizes HH:mm:ss and day-keyed Digilist hours", () => {
    expect(normalizeClockTime("08:00:00")).toBe("08:00");
    expect(
      weekdayWindowFromOpeningHours({
        monday: { open: "08:00:00", close: "12:00:00" },
        saturday: { open: "00:00", close: "00:00", isClosed: true },
      }),
    ).toEqual({ openTime: "08:00", closeTime: "12:00" });
  });

  it("shifts Digilist engine open earlier for Convex UTC hour checks", () => {
    expect(digilistEngineOpenTime("11:00")).toBe("09:00");
    expect(digilistEngineOpenTime("08:00")).toBe("06:00");
    expect(digilistEngineOpenTime("01:00")).toBe("00:00");
    expect(
      buildDigilistOpeningHours("11:00", "17:00").find(
        (row) => row.dayIndex === 1,
      ),
    ).toMatchObject({ open: "09:00", close: "17:00" });
  });

  it("checks an Oslo clock window", () => {
    expect(isWithinWeekdayClockWindow("11:00", "12:00", "11:00", "17:00")).toBe(
      true,
    );
    expect(isWithinWeekdayClockWindow("10:00", "11:00", "11:00", "17:00")).toBe(
      false,
    );
  });

  it("validates clock times", () => {
    expect(isValidClockTime("08:00")).toBe(true);
    expect(isValidClockTime("08:00:00")).toBe(true);
    expect(isValidClockTime("24:00")).toBe(false);
    expect(clockToMinutes("09:30")).toBe(570);
  });

  it("rejects inverted open/close on create schema", () => {
    const result = roomCreateSchema.safeParse({
      name: "Test",
      capacity: 10,
      description: "Beskrivelse",
      amenities: ["Skjerm"],
      openTime: "17:00",
      closeTime: "08:00",
    });
    expect(result.success).toBe(false);
  });

  it("defaults open/close when omitted", () => {
    const parsed = roomCreateSchema.parse({
      name: "Test",
      capacity: 10,
      description: "Beskrivelse",
      amenities: ["Skjerm"],
    });
    expect(parsed.openTime).toBe("08:00");
    expect(parsed.closeTime).toBe("17:00");
  });

  it("requires description and at least one amenity", () => {
    expect(
      roomCreateSchema.safeParse({
        name: "Test",
        capacity: 10,
        amenities: ["Skjerm"],
      }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({
        name: "Test",
        capacity: 10,
        description: "Beskrivelse",
        amenities: [],
      }).success,
    ).toBe(false);
  });
});
