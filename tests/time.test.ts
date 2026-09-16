import { describe, expect, it } from "vitest";
import { interval, overlaps } from "../shared/time";
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
  it("allows adjacent reservations but detects partial overlap", () => {
    const a = { startTime: 10, endTime: 20 };
    expect(overlaps(a, { startTime: 20, endTime: 30 })).toBe(false);
    expect(overlaps(a, { startTime: 19, endTime: 30 })).toBe(true);
    expect(overlaps(a, { startTime: 5, endTime: 11 })).toBe(true);
  });
});
