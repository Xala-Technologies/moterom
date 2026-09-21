import { describe, expect, it } from "vitest";
import rooms from "../config/rooms.json";
import {
  clipInterval,
  hoursFromMs,
  interval,
  osloDayRange,
} from "../shared/time";
import {
  assignCompany,
  buildInsights,
  collectPaged,
  formatAbsoluteChange,
  parseInsightsQuery,
  previousPeriod,
} from "../server/insights";
import type { InsightsBooking, Room } from "../shared/types";
import { AppError } from "../shared/validation";

const catalog = rooms as Room[];
const roomA = catalog[0];
const roomB = catalog[1];

function booking(
  partial: Partial<InsightsBooking> &
    Pick<InsightsBooking, "id" | "startTime" | "endTime">,
): InsightsBooking {
  return {
    roomId: roomA.id,
    status: "confirmed",
    ...partial,
  };
}

describe("insights aggregation", () => {
  it("clips reserved hours to the Oslo period and ignores pending requests", () => {
    const period = {
      from: "2027-01-15",
      to: "2027-01-16",
      ...osloDayRange("2027-01-15", "2027-01-16"),
      fromMs: osloDayRange("2027-01-15", "2027-01-16").startTime,
      toMs: osloDayRange("2027-01-15", "2027-01-16").endTime,
    };
    const overnight = interval({
      date: "2027-01-14",
      start: "22:00",
      end: "23:00",
    });
    const late = {
      startTime: overnight.startTime,
      endTime: period.fromMs + 2 * 60 * 60 * 1000,
    };
    const data = buildInsights({
      mode: "demo",
      rooms: [roomA, roomB],
      coverage: "complete",
      period,
      bookings: [
        booking({
          id: "overlap",
          startTime: late.startTime,
          endTime: late.endTime,
        }),
        booking({
          id: "pending",
          status: "pending",
          ...interval({ date: "2027-01-15", start: "09:00", end: "12:00" }),
        }),
        booking({
          id: "inside",
          ...interval({ date: "2027-01-15", start: "10:00", end: "11:30" }),
        }),
      ],
    });
    const row = data.rooms.find((r) => r.roomId === roomA.id)!;
    expect(row.bookingCount).toBe(1);
    expect(row.reservedHours).toBe(3.5);
    expect(data.rooms.find((r) => r.roomId === roomB.id)?.bookingCount).toBe(0);
    expect(data.rooms.find((r) => r.roomId === roomB.id)?.reservedHours).toBe(
      0,
    );
    expect(data.trend[0]?.reservedHours).toBe(3.5);
  });

  it("splits a cross-midnight reservation across Oslo days", () => {
    const periodDates = { from: "2027-01-15", to: "2027-01-17" };
    const range = osloDayRange(periodDates.from, periodDates.to);
    const start = interval({
      date: "2027-01-15",
      start: "23:00",
      end: "23:30",
    }).startTime;
    const end = interval({
      date: "2027-01-16",
      start: "01:00",
      end: "01:30",
    }).startTime;
    const data = buildInsights({
      mode: "demo",
      rooms: [roomA],
      coverage: "complete",
      period: { ...periodDates, fromMs: range.startTime, toMs: range.endTime },
      bookings: [booking({ id: "night", startTime: start, endTime: end })],
    });
    expect(data.trend.map((p) => p.reservedHours)).toEqual([2]);
    expect(data.trendGrain).toBe("week");
    expect(data.trend[0]?.from).toBe("2027-01-15");
    expect(data.trend[0]?.toInclusive).toBe("2027-01-16");
    expect(data.totals.bookingCount).toBe(1);
    expect(data.totals.reservedHours).toBe(2);
  });

  it("uses months for ranges longer than about two months", () => {
    const periodDates = { from: "2027-01-01", to: "2027-04-01" };
    const range = osloDayRange(periodDates.from, periodDates.to);
    const data = buildInsights({
      mode: "demo",
      rooms: [roomA],
      coverage: "complete",
      period: { ...periodDates, fromMs: range.startTime, toMs: range.endTime },
      bookings: [
        booking({
          id: "jan",
          ...interval({ date: "2027-01-10", start: "09:00", end: "10:00" }),
        }),
        booking({
          id: "mar",
          ...interval({ date: "2027-03-10", start: "09:00", end: "11:00" }),
        }),
      ],
    });
    expect(data.trendGrain).toBe("month");
    expect(data.trend.map((p) => p.date)).toEqual([
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
    ]);
    expect(data.trend.map((p) => p.reservedHours)).toEqual([1, 0, 2]);
  });

  it("keeps DST spring and autumn elapsed time, not clock-face hours", () => {
    const spring = interval({
      date: "2026-03-29",
      start: "01:00",
      end: "03:00",
    });
    expect(hoursFromMs(spring.endTime - spring.startTime)).toBe(1);
    const autumn = interval({
      date: "2026-10-25",
      start: "01:00",
      end: "03:00",
    });
    expect(hoursFromMs(autumn.endTime - autumn.startTime)).toBe(3);
  });

  it("does not invent a percentage when the previous period is zero", () => {
    expect(formatAbsoluteChange(4, 0)).toBe("fra 0 til 4");
    expect(formatAbsoluteChange(0, 0)).toBe("uendret");
    expect(formatAbsoluteChange(5, 3)).toBe("+2");
    expect(formatAbsoluteChange(1, 4)).toBe("-3");
  });

  it("withholds comparison when either window is truncated", () => {
    const period = {
      from: "2027-02-01",
      to: "2027-02-02",
      ...osloDayRange("2027-02-01", "2027-02-02"),
      fromMs: osloDayRange("2027-02-01", "2027-02-02").startTime,
      toMs: osloDayRange("2027-02-01", "2027-02-02").endTime,
    };
    const data = buildInsights({
      mode: "live",
      rooms: [roomA],
      coverage: "truncated",
      period,
      comparePeriod: previousPeriod(period),
      compareBookings: [],
      compareCoverage: "complete",
      bookings: [],
    });
    expect(data.comparePeriod).toBeUndefined();
    expect(data.compareTotals).toBeUndefined();
  });

  it("marks paging as truncated at the safety cap", async () => {
    let page = 0;
    const result = await collectPaged(
      async () => {
        page += 1;
        return Array.from({ length: 500 }, (_, i) => ({
          id: `${page}-${i}`,
          startTime: page * 1000 + i,
        }));
      },
      0,
      500,
      1000,
    );
    expect(result.items).toHaveLength(1000);
    expect(result.truncated).toBe(true);
  });

  it("drops unknown room IDs and rejects a filter with only unknown rooms", () => {
    const parsed = parseInsightsQuery(
      { periode: "7d", rom: `${roomA.id},ghost` },
      catalog.map((r) => r.id),
      interval({ date: "2027-06-01", start: "12:00", end: "13:00" }).startTime,
    );
    expect(parsed.roomIds).toEqual([roomA.id]);
    expect(parsed.ignoredRoomIds).toEqual(["ghost"]);
    expect(() =>
      parseInsightsQuery({ periode: "7d", rom: "ghost" }, [roomA.id]),
    ).toThrow(AppError);
  });

  it("ranks companies by reserved hours and ignores an unknown company", () => {
    const periodDates = { from: "2027-01-15", to: "2027-01-16" };
    const range = osloDayRange(periodDates.from, periodDates.to);
    const period = {
      ...periodDates,
      fromMs: range.startTime,
      toMs: range.endTime,
    };
    const bookings = [
      booking({
        id: "alfa",
        company: "Alfa",
        email: "secret@example.invalid",
        ...interval({ date: "2027-01-15", start: "10:00", end: "12:00" }),
      }),
      booking({
        id: "beta",
        roomId: roomB.id,
        company: "Beta",
        ...interval({ date: "2027-01-15", start: "10:00", end: "11:00" }),
      }),
      booking({
        id: "unnamed",
        company: "",
        ...interval({ date: "2027-01-15", start: "13:00", end: "13:30" }),
      }),
      booking({
        id: "pending",
        company: "Alfa",
        status: "pending",
        ...interval({ date: "2027-01-15", start: "08:00", end: "18:00" }),
      }),
    ];
    const data = buildInsights({
      mode: "demo",
      rooms: [roomA, roomB],
      coverage: "complete",
      period,
      bookings,
      company: "Finnes ikke",
    });
    expect(data.companies.map((row) => row.company)).toEqual([
      "Alfa",
      "Beta",
      "",
    ]);
    expect(data.companies[0]?.rooms.map((room) => room.roomId)).toEqual([
      roomA.id,
    ]);
    expect(data.companies[0]?.reservedHours).toBe(2);
    expect(data.totals.bookingCount).toBe(3);
    expect(JSON.stringify(data)).not.toContain("secret@example.invalid");

    const narrowed = buildInsights({
      mode: "demo",
      rooms: [roomA, roomB],
      coverage: "complete",
      period,
      bookings,
      company: "Alfa",
    });
    expect(narrowed.companies).toHaveLength(3);
    expect(narrowed.totals).toEqual({ bookingCount: 1, reservedHours: 2 });
    expect(
      narrowed.rooms.find((room) => room.roomId === roomB.id)?.bookingCount,
    ).toBe(0);
  });

  it("matches a company from email and does not keep the address", () => {
    const stamped = assignCompany(
      [
        booking({
          id: "matched",
          startTime: 1,
          endTime: 2,
          email: "Ola@Example.invalid",
        }),
        booking({
          id: "missing",
          startTime: 1,
          endTime: 2,
          email: "missing@example.invalid",
        }),
      ],
      new Map([["ola@example.invalid", "Alfa"]]),
    );
    expect(stamped.map((item) => item.company)).toEqual(["Alfa", ""]);
    expect(stamped.every((item) => !("email" in item))).toBe(true);
  });
});

describe("Oslo clip helper", () => {
  it("returns undefined when intervals do not overlap", () => {
    expect(
      clipInterval(
        { startTime: 0, endTime: 10 },
        { startTime: 10, endTime: 20 },
      ),
    ).toBeUndefined();
  });
});
