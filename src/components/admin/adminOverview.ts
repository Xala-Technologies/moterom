import { Temporal } from "@js-temporal/polyfill";
import { addDays, osloDayRange, overlaps } from "../../../shared/time";

export const OVERVIEW_PROGRAMME_LIMIT = 5;
export const OVERVIEW_PENDING_LIMIT = 5;

const CLOSED = new Set(["cancelled", "rejected"]);
const CONFIRMED = new Set(["confirmed", "approved"]);

export function parseOsloDate(
  value: string | null | undefined,
): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  try {
    return Temporal.PlainDate.from(value).toString() === value
      ? value
      : undefined;
  } catch {
    return;
  }
}

/** Inclusive start, exclusive end: midnight to next midnight in Europe/Oslo. */
export function osloDaySpan(date: string) {
  return osloDayRange(date, addDays(date, 1));
}

export function isActiveBooking(status: string) {
  return !CLOSED.has(status);
}

export function bookingsOverlappingDay<
  T extends { status: string; startTime: number; endTime: number },
>(bookings: T[], date: string): T[] {
  const span = osloDaySpan(date);
  return bookings.filter(
    (booking) => isActiveBooking(booking.status) && overlaps(booking, span),
  );
}

export function happeningNowRoomIds<
  T extends { roomId: string; startTime: number; endTime: number },
>(events: T[], now: number): string[] {
  return [
    ...new Set(
      events
        .filter((event) => event.startTime <= now && event.endTime > now)
        .map((event) => event.roomId),
    ),
  ];
}

export function pendingBookings<
  T extends { status: string; startTime: number },
>(bookings: T[]): T[] {
  return bookings
    .filter((booking) => booking.status === "pending")
    .sort((a, b) => a.startTime - b.startTime);
}

export type ProgrammeWindow<T> = {
  source: T[];
  preview: T[];
  hasMore: boolean;
};

/**
 * Today shows meetings that are still running or have not started.
 * Other days, and a today with nothing left, show the whole day.
 * `hasMore` counts that source, not rows hidden because they already ended.
 */
export function programmeWindow<
  T extends { startTime: number; endTime: number },
>(
  dayEvents: T[],
  opts: { viewingToday: boolean; now: number; limit?: number },
): ProgrammeWindow<T> {
  const limit = opts.limit ?? OVERVIEW_PROGRAMME_LIMIT;
  const sorted = [...dayEvents].sort((a, b) => a.startTime - b.startTime);
  const upcoming = sorted.filter((event) => event.endTime > opts.now);
  const source = opts.viewingToday && upcoming.length > 0 ? upcoming : sorted;
  const preview = source.slice(0, limit);
  return {
    source,
    preview,
    hasMore: source.length > preview.length,
  };
}

export function eventsOnDay<T extends { startTime: number; endTime: number }>(
  events: T[],
  date: string,
): T[] {
  const span = osloDaySpan(date);
  return events.filter((event) => overlaps(event, span));
}

export function bookingStatusParam(value: string | null | undefined): string {
  if (value === "approved" || value === "confirmed") return "confirmed";
  if (value === "pending" || value === "cancelled" || value === "rejected")
    return value;
  return "all";
}

export function matchesBookingStatus(status: string, filter: string): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "confirmed") return CONFIRMED.has(status);
  return status === filter;
}

export function matchesRoomFilter(roomId: string, filter: string): boolean {
  return !filter || filter === "all" || roomId === filter;
}

export function matchesBookingQuery(
  booking: {
    roomName: string;
    name: string;
    email: string;
    reference: string;
    title: string;
  },
  term: string,
): boolean {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return `${booking.roomName} ${booking.name} ${booking.email} ${booking.reference} ${booking.title}`
    .toLowerCase()
    .includes(query);
}

export function calendarHref(date: string, todayDate: string): string {
  return date === todayDate
    ? "/admin/calendar"
    : `/admin/calendar?dato=${encodeURIComponent(date)}`;
}

export function newBookingHref(_date: string): string {
  return "/";
}
