import { describe, expect, it } from "vitest";
import { interval } from "../shared/time";
import {
  bookingStatusParam,
  bookingsOverlappingDay,
  calendarHref,
  eventsOnDay,
  happeningNowRoomIds,
  matchesBookingStatus,
  OVERVIEW_PROGRAMME_LIMIT,
  parseOsloDate,
  pendingBookings,
  programmeWindow,
} from "../src/components/admin/adminOverview";

function slot(date: string, start: string, end: string) {
  return interval({ date, start, end });
}

describe("admin overview classification", () => {
  const todayDate = "2027-01-15";
  const morning = slot(todayDate, "09:00", "10:00");
  const midday = slot(todayDate, "12:00", "13:00");
  const evening = slot(todayDate, "16:00", "17:00");
  const now = morning.startTime + 30 * 60 * 1000;

  it("rejects dates that are not a real Oslo calendar day", () => {
    expect(parseOsloDate("2027-01-15")).toBe("2027-01-15");
    expect(parseOsloDate("2026-02-31")).toBeUndefined();
    expect(parseOsloDate("15.01.2027")).toBeUndefined();
    expect(parseOsloDate(null)).toBeUndefined();
  });

  it("counts pending globally and daily bookings only on the selected day", () => {
    const bookings = [
      { id: "today-pending", status: "pending", ...morning },
      {
        id: "later-pending",
        status: "pending",
        ...slot("2027-01-20", "09:00", "10:00"),
      },
      { id: "today-confirmed", status: "confirmed", ...midday },
      { id: "cancelled", status: "cancelled", ...evening },
      { id: "approved", status: "approved", ...evening },
    ];
    expect(
      bookingsOverlappingDay(bookings, todayDate).map((b) => b.id),
    ).toEqual(["today-pending", "today-confirmed", "approved"]);
    expect(pendingBookings(bookings).map((b) => b.id)).toEqual([
      "today-pending",
      "later-pending",
    ]);
  });

  it("counts one room once when a booking and a block overlap now", () => {
    const rooms = happeningNowRoomIds(
      [
        { roomId: "sauda-1", ...morning },
        { roomId: "sauda-1", kind: "block", ...morning },
        { roomId: "tysso", ...evening },
      ],
      now,
    );
    expect(rooms).toEqual(["sauda-1"]);
  });

  it("does not count finished meetings as happening now", () => {
    expect(
      happeningNowRoomIds([{ roomId: "sauda-1", ...morning }], morning.endTime),
    ).toEqual([]);
  });

  it("limits today's programme to still-open meetings and ignores finished rows in hasMore", () => {
    const finished = Array.from({ length: 6 }, (_, i) =>
      slot(todayDate, `0${i + 1}:00`, `0${i + 1}:30`),
    );
    const open = [midday, evening];
    const window = programmeWindow([...finished, ...open], {
      viewingToday: true,
      now,
      limit: OVERVIEW_PROGRAMME_LIMIT,
    });
    expect(window.source).toHaveLength(2);
    expect(window.preview).toHaveLength(2);
    expect(window.hasMore).toBe(false);
  });

  it("sets hasMore from the upcoming source, not the hidden past", () => {
    const open = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"].map(
      (start) => {
        const hour = Number(start.slice(0, 2));
        const end = `${String(hour + 1).padStart(2, "0")}:00`;
        return slot(todayDate, start, end);
      },
    );
    const window = programmeWindow(
      [slot(todayDate, "08:00", "09:00"), ...open],
      { viewingToday: true, now, limit: 5 },
    );
    expect(window.source).toHaveLength(6);
    expect(window.preview).toHaveLength(5);
    expect(window.hasMore).toBe(true);
  });

  it("shows the full day when nothing is left today or the date is not today", () => {
    const day = eventsOnDay(
      [morning, slot("2027-01-16", "09:00", "10:00")],
      todayDate,
    );
    const finishedToday = programmeWindow(day, {
      viewingToday: true,
      now: evening.endTime,
    });
    expect(finishedToday.source).toEqual(day);
    expect(finishedToday.hasMore).toBe(false);

    const other = programmeWindow(
      Array.from({ length: 6 }, () => morning),
      { viewingToday: false, now },
    );
    expect(other.hasMore).toBe(true);
    expect(other.source).toHaveLength(6);
  });

  it("treats Digilist approved as confirmed in the bookings filter", () => {
    expect(bookingStatusParam("approved")).toBe("confirmed");
    expect(bookingStatusParam("nope")).toBe("all");
    expect(matchesBookingStatus("approved", "confirmed")).toBe(true);
    expect(matchesBookingStatus("pending", "confirmed")).toBe(false);
    expect(matchesBookingStatus("pending", "pending")).toBe(true);
  });

  it("opens today's calendar without a date query", () => {
    expect(calendarHref(todayDate, todayDate)).toBe("/admin/calendar");
    expect(calendarHref("2027-01-16", todayDate)).toBe(
      "/admin/calendar?dato=2027-01-16",
    );
  });
});
