import { describe, expect, it } from "vitest";
import {
  compareAgenda,
  compareHistory,
  compareUpcoming,
  isOpenBooking,
} from "../shared/bookingOrder";

const now = Date.parse("2026-09-19T12:00:00Z");

function booking(
  id: string,
  start: string,
  status = "confirmed",
  endHours = 1,
): {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
} {
  const startTime = Date.parse(start);
  return {
    id,
    startTime,
    endTime: startTime + endHours * 60 * 60 * 1000,
    status,
  };
}

describe("booking order", () => {
  it("puts the next open meeting first", () => {
    const later = booking("b", "2026-09-28T08:00:00Z");
    const sooner = booking("a", "2026-09-21T08:00:00Z");
    expect(
      [later, sooner].sort(compareUpcoming).map((item) => item.id),
    ).toEqual(["a", "b"]);
  });

  it("puts the most recent closed meeting first", () => {
    const older = booking("old", "2026-09-01T08:00:00Z", "cancelled");
    const newer = booking("new", "2026-09-10T08:00:00Z", "cancelled");
    expect([older, newer].sort(compareHistory).map((item) => item.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("keeps pending above the next meeting and closed history last", () => {
    const pending = booking("pending", "2026-10-01T08:00:00Z", "pending");
    const next = booking("next", "2026-09-21T08:00:00Z");
    const later = booking("later", "2026-09-28T08:00:00Z");
    const closed = booking("closed", "2026-09-18T08:00:00Z", "cancelled");
    expect(
      [closed, later, pending, next]
        .sort((a, b) => compareAgenda(a, b, now))
        .map((item) => item.id),
    ).toEqual(["pending", "next", "later", "closed"]);
  });

  it("treats a cancelled future booking as closed", () => {
    expect(
      isOpenBooking(booking("x", "2026-09-28T08:00:00Z", "cancelled"), now),
    ).toBe(false);
  });
});
