import { Temporal } from "@js-temporal/polyfill";
import type {
  InsightsBlock,
  InsightsBooking,
  InsightsBucket,
  InsightsCompanyRow,
  InsightsCoverage,
  InsightsEnvelope,
  InsightsPeriod,
  InsightsPeriodPreset,
  InsightsRecord,
  InsightsRoomReport,
  InsightsRoomRow,
  InsightsTrendPoint,
  Room,
} from "../shared/types";
import { RESERVATION_STATUSES } from "../shared/types";
import {
  addDays,
  clipInterval,
  eachOsloDate,
  hoursFromMs,
  osloDateFromMs,
  osloDayRange,
  osloMonday,
  osloMonthStart,
  ZONE,
} from "../shared/time";
import { AppError } from "../shared/validation";
import { translateMessage } from "../shared/i18n/messages";
import { DEFAULT_LOCALE, toBcp47, type Locale } from "../shared/i18n/locale";

export const INSIGHTS_LOOKBACK_MS = 36 * 60 * 60 * 1000;
export const INSIGHTS_PAGE_SIZE = 500;
export const INSIGHTS_MAX_ROWS = 10_000;
export const INSIGHTS_UPCOMING_DAYS = 14;

const WEEKDAY_KEYS = [
  "weekday_mon",
  "weekday_tue",
  "weekday_wed",
  "weekday_thu",
  "weekday_fri",
  "weekday_sat",
  "weekday_sun",
] as const;

export const isReservationStatus = (status: string) =>
  (RESERVATION_STATUSES as readonly string[]).includes(status);

export function reservationBookings(bookings: InsightsBooking[]) {
  return bookings.filter((b) => isReservationStatus(b.status));
}

export function parseInsightsQuery(
  query: Record<string, unknown>,
  configuredIds: string[],
  now = Date.now(),
) {
  const preset = parsePreset(String(query.periode ?? "30d"));
  const compare = query.sammenlign === "1" || query.sammenlign === "true";
  const todayDate = osloDateFromMs(now);
  let fromDate: string;
  let toExclusive: string;
  if (preset === "custom") {
    fromDate = String(query.fra ?? "");
    const til = String(query.til ?? "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(til)
    )
      throw new AppError(
        400,
        "Velg en gyldig fra- og tildato.",
        "invalid_date_range",
      );
    toExclusive = addDays(til, 1);
  } else {
    const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    toExclusive = addDays(todayDate, 1);
    fromDate = addDays(toExclusive, -days);
  }
  if (fromDate >= toExclusive)
    throw new AppError(
      400,
      "Sluttdato må være etter startdato.",
      "end_after_start",
    );
  const dates = eachOsloDate(fromDate, toExclusive);
  if (dates.length > 366)
    throw new AppError(
      400,
      "Velg en periode på høyst ett år.",
      "period_too_long",
    );
  const requested = String(query.rom ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !configuredIds.includes(id));
  const roomIds = requested.filter((id) => configuredIds.includes(id));
  if (requested.length > 0 && roomIds.length === 0)
    throw new AppError(400, "Ukjent rom.", "unknown_room");
  return {
    preset,
    compare,
    ignoredRoomIds: unknown,
    roomIds: roomIds.length ? roomIds : [...configuredIds],
    period: periodFromDates(fromDate, toExclusive),
  };
}

export function previousPeriod(period: InsightsPeriod): InsightsPeriod {
  const days = eachOsloDate(period.from, period.to).length;
  const toExclusive = period.from;
  const fromDate = addDays(toExclusive, -days);
  return periodFromDates(fromDate, toExclusive);
}

export function periodFromDates(
  fromDate: string,
  toExclusive: string,
): InsightsPeriod {
  const range = osloDayRange(fromDate, toExclusive);
  return {
    from: fromDate,
    to: toExclusive,
    fromMs: range.startTime,
    toMs: range.endTime,
  };
}

export async function collectPaged<T extends { id: string; startTime: number }>(
  fetchPage: (startAfter: number) => Promise<T[]>,
  startAfter: number,
  pageSize = INSIGHTS_PAGE_SIZE,
  maxRows = INSIGHTS_MAX_ROWS,
) {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor = startAfter;
  while (items.length < maxRows) {
    const page = await fetchPage(cursor);
    if (!page.length) return { items, truncated: false as const };
    let advanced = false;
    for (const item of page) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
      if (item.startTime > cursor) {
        cursor = item.startTime;
        advanced = true;
      }
      if (items.length >= maxRows)
        return { items, truncated: page.length >= pageSize };
    }
    if (page.length < pageSize) return { items, truncated: false as const };
    if (!advanced) return { items, truncated: true as const };
  }
  return { items, truncated: true as const };
}

export function assignCompany(
  bookings: InsightsBooking[],
  companyByEmail: ReadonlyMap<string, string>,
): InsightsBooking[] {
  return bookings.map(({ email, ...booking }) => {
    const key = (email || "").trim().toLowerCase();
    return {
      ...booking,
      company: key ? companyByEmail.get(key) || "" : "",
    };
  });
}

export function buildInsights(input: {
  mode: "demo" | "live";
  rooms: Room[];
  bookings: InsightsBooking[];
  coverage: InsightsCoverage;
  period: InsightsPeriod;
  comparePeriod?: InsightsPeriod;
  compareBookings?: InsightsBooking[];
  compareCoverage?: InsightsCoverage;
  company?: string;
  now?: number;
  generatedAt?: number;
  locale?: Locale;
}): InsightsEnvelope {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const now = input.now ?? Date.now();
  const generatedAt = input.generatedAt ?? now;
  const scoped = input.rooms;
  const roomIds = new Set(scoped.map((room) => room.id));
  const inRooms = input.bookings.filter((b) => roomIds.has(b.roomId));
  const compareInRooms = (input.compareBookings || []).filter((b) =>
    roomIds.has(b.roomId),
  );
  const companies = companyRows(inRooms, scoped, input.period, locale);
  const selected = matchedCompany(input.company, companies);
  const bookings = selected
    ? inRooms.filter((b) => (b.company || "").trim() === selected)
    : inRooms;
  const compareBookings = selected
    ? compareInRooms.filter((b) => (b.company || "").trim() === selected)
    : compareInRooms;
  const rooms = scoped.map((room) =>
    roomRow(
      room,
      bookings,
      input.period,
      canCompareDraft(input) ? compareBookings : undefined,
      input.comparePeriod,
    ),
  );
  const totals = totalsFromRooms(rooms);
  const canCompare = canCompareDraft(input);
  const trend = trendSeries(bookings, input.period, now, locale);
  if (canCompare && input.comparePeriod) {
    const previous = trendSeries(
      compareBookings,
      input.comparePeriod,
      now,
      locale,
    );
    for (let i = 0; i < trend.points.length; i++) {
      const point = trend.points[i]!;
      const prior = previous.points[i];
      point.previousReservedHours = prior?.reservedHours ?? 0;
      point.previousBookingCount = prior?.bookingCount ?? 0;
    }
  }
  return {
    mode: input.mode,
    coverage: input.coverage,
    timezone: ZONE,
    period: input.period,
    comparePeriod: canCompare ? input.comparePeriod : undefined,
    includedStatuses: [...RESERVATION_STATUSES],
    generatedAt,
    definitions: [
      {
        id: "bookingCount",
        label: translateMessage(locale, "insights_def_booking_count"),
      },
      {
        id: "reservedHours",
        label: translateMessage(locale, "insights_def_reserved_hours"),
      },
    ],
    rooms,
    companies,
    trend: trend.points,
    trendGrain: trend.grain,
    totals,
    compareTotals: canCompare
      ? totalsFromRooms(
          scoped.map((room) =>
            roomRow(room, compareBookings, input.comparePeriod!),
          ),
        )
      : undefined,
  };
}

function canCompareDraft(input: {
  comparePeriod?: InsightsPeriod;
  coverage: InsightsCoverage;
  compareCoverage?: InsightsCoverage;
}) {
  return (
    Boolean(input.comparePeriod) &&
    input.coverage === "complete" &&
    input.compareCoverage === "complete"
  );
}

export function buildRoomReport(input: {
  envelope: InsightsEnvelope;
  roomId: string;
  bookings: InsightsBooking[];
  blocks: InsightsBlock[];
  now?: number;
  locale?: Locale;
}): InsightsRoomReport {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const now = input.now ?? Date.now();
  const room = input.envelope.rooms.find((r) => r.roomId === input.roomId);
  if (!room)
    throw new AppError(404, "Rommet ble ikke funnet.", "room_not_found");
  const upcomingTo = now + INSIGHTS_UPCOMING_DAYS * 24 * 60 * 60 * 1000;
  const upcomingWindow = { startTime: now, endTime: upcomingTo };
  const upcoming = reservationBookings(input.bookings)
    .filter(
      (b) =>
        b.roomId === input.roomId &&
        b.startTime >= now &&
        b.startTime < upcomingTo,
    )
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 12)
    .map(toRecord);
  const upcomingBlocks = input.blocks
    .filter((b) => b.roomId === input.roomId && clipInterval(b, upcomingWindow))
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 12);
  const limitations = [
    input.envelope.coverage === "truncated"
      ? translateMessage(locale, "insights_limit_truncated")
      : undefined,
    input.envelope.mode === "demo"
      ? translateMessage(locale, "insights_limit_demo")
      : undefined,
    translateMessage(locale, "insights_limit_confirmed_only"),
    translateMessage(locale, "insights_limit_not_attendance"),
    translateMessage(locale, "insights_limit_no_opening_hours"),
  ].filter((item): item is string => Boolean(item));
  const trend = trendSeries(
    input.bookings.filter((b) => b.roomId === input.roomId),
    input.envelope.period,
    now,
    locale,
  );
  return {
    ...input.envelope,
    rooms: [room],
    trend: trend.points,
    trendGrain: trend.grain,
    totals: {
      bookingCount: room.bookingCount,
      reservedHours: room.reservedHours,
    },
    compareTotals: input.envelope.comparePeriod
      ? {
          bookingCount: room.previousBookingCount ?? 0,
          reservedHours: room.previousReservedHours ?? 0,
        }
      : undefined,
    room,
    busiest: busiestBuckets(
      input.bookings.filter((b) => b.roomId === input.roomId),
      input.envelope.period,
      3,
      locale,
    ),
    upcoming,
    upcomingBlocks,
    limitations,
  };
}

export function formatAbsoluteChange(
  current: number,
  previous: number,
  locale: Locale = DEFAULT_LOCALE,
) {
  if (previous === 0 && current === 0)
    return translateMessage(locale, "insights_unchanged");
  if (previous === 0)
    return translateMessage(locale, "insights_from_zero", { value: current });
  const delta = current - previous;
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function parsePreset(value: string): InsightsPeriodPreset {
  if (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "custom"
  )
    return value;
  throw new AppError(400, "Ugyldig periode.", "invalid_period");
}

function roomRow(
  room: Room,
  bookings: InsightsBooking[],
  period: InsightsPeriod,
  compareBookings?: InsightsBooking[],
  comparePeriod?: InsightsPeriod,
): InsightsRoomRow {
  const current = roomMetrics(room.id, bookings, period);
  const previous =
    compareBookings && comparePeriod
      ? roomMetrics(room.id, compareBookings, comparePeriod)
      : undefined;
  return {
    roomId: room.id,
    name: room.name,
    capacity: room.capacity,
    capacityLabel: room.capacityLabel,
    capacityLabelEn: room.capacityLabelEn,
    amenities: room.amenities,
    image: room.image,
    bookingCount: current.count,
    reservedHours: current.hours,
    averageDurationHours:
      current.count === 0
        ? null
        : hoursFromMs((current.hours * 3600000) / current.count),
    previousBookingCount: previous?.count,
    previousReservedHours: previous?.hours,
  };
}

function matchedCompany(
  company: string | undefined,
  rows: InsightsCompanyRow[],
) {
  const wanted = (company || "").trim();
  if (!wanted || !rows.some((row) => row.company === wanted)) return "";
  return wanted;
}

function companyRows(
  bookings: InsightsBooking[],
  rooms: Room[],
  period: InsightsPeriod,
  locale: Locale,
): InsightsCompanyRow[] {
  const groups = new Map<string, InsightsBooking[]>();
  for (const booking of reservationBookings(bookings)) {
    const company = (booking.company || "").trim();
    const group = groups.get(company) ?? [];
    group.push(booking);
    groups.set(company, group);
  }
  const collator = new Intl.Collator(toBcp47(locale));
  return [...groups.entries()]
    .map(([company, items]) => {
      const current = periodMetrics(items, period);
      const breakdown = rooms
        .map((room) => {
          const metrics = periodMetrics(
            items.filter((item) => item.roomId === room.id),
            period,
          );
          return {
            roomId: room.id,
            bookingCount: metrics.count,
            reservedHours: metrics.hours,
          };
        })
        .filter((room) => room.bookingCount > 0 || room.reservedHours > 0)
        .sort((a, b) => compareMetrics(a, b, collator));
      return {
        company,
        bookingCount: current.count,
        reservedHours: current.hours,
        rooms: breakdown,
      };
    })
    .filter((row) => row.bookingCount > 0 || row.reservedHours > 0)
    .sort((a, b) => compareMetrics(a, b, collator));
}

function compareMetrics(
  a: {
    company?: string;
    roomId?: string;
    reservedHours: number;
    bookingCount: number;
  },
  b: {
    company?: string;
    roomId?: string;
    reservedHours: number;
    bookingCount: number;
  },
  collator: Intl.Collator,
) {
  if (b.reservedHours !== a.reservedHours)
    return b.reservedHours - a.reservedHours;
  if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
  return collator.compare(
    a.company || a.roomId || "",
    b.company || b.roomId || "",
  );
}

function periodMetrics(bookings: InsightsBooking[], period: InsightsPeriod) {
  const window = { startTime: period.fromMs, endTime: period.toMs };
  const held = reservationBookings(bookings);
  const count = held.filter(
    (b) => b.startTime >= period.fromMs && b.startTime < period.toMs,
  ).length;
  const hours = hoursFromMs(
    held.reduce((sum, b) => {
      const clip = clipInterval(b, window);
      return sum + (clip ? clip.endTime - clip.startTime : 0);
    }, 0),
  );
  return { count, hours };
}

function roomMetrics(
  roomId: string,
  bookings: InsightsBooking[],
  period: InsightsPeriod,
) {
  return periodMetrics(
    bookings.filter((booking) => booking.roomId === roomId),
    period,
  );
}

function totalsFromRooms(rooms: InsightsRoomRow[]) {
  return {
    bookingCount: rooms.reduce((sum, room) => sum + room.bookingCount, 0),
    reservedHours: hoursFromMs(
      rooms.reduce((sum, room) => sum + room.reservedHours * 3600000, 0),
    ),
  };
}

function trendSeries(
  bookings: InsightsBooking[],
  period: InsightsPeriod,
  now: number,
  locale: Locale = DEFAULT_LOCALE,
): { grain: "week" | "month"; points: InsightsTrendPoint[] } {
  const dates = eachOsloDate(period.from, period.to);
  // 7d/30d → weeks; 90d and longer custom ranges → months.
  const grain = dates.length > 62 ? "month" : "week";
  const held = reservationBookings(bookings);
  const buckets = new Map<string, InsightsTrendPoint>();
  const add = (
    date: string,
    hours: number,
    count: number,
    incomplete: boolean,
  ) => {
    const key = grain === "month" ? osloMonthStart(date) : osloMonday(date);
    const range = bucketRange(grain, key, period);
    const current = buckets.get(key) || {
      date: key,
      from: range.from,
      toInclusive: range.toInclusive,
      label: trendLabel(grain, key, locale),
      reservedHours: 0,
      bookingCount: 0,
      incomplete: false,
    };
    current.reservedHours = hoursFromMs(
      current.reservedHours * 3600000 + hours * 3600000,
    );
    current.bookingCount += count;
    current.incomplete = current.incomplete || incomplete;
    buckets.set(key, current);
  };
  const todayDate = osloDateFromMs(now);
  for (const date of dates) {
    const day = osloDayRange(date, addDays(date, 1));
    const incomplete = date === todayDate && now < day.endTime;
    const hours = hoursFromMs(
      held.reduce((sum, b) => {
        const clip = clipInterval(b, day);
        return sum + (clip ? clip.endTime - clip.startTime : 0);
      }, 0),
    );
    const count = held.filter(
      (b) => b.startTime >= day.startTime && b.startTime < day.endTime,
    ).length;
    add(date, hours, count, incomplete);
  }
  return {
    grain,
    points: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function trendLabel(
  grain: "week" | "month",
  key: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const date = Temporal.PlainDate.from(key);
  if (grain === "week")
    return translateMessage(locale, "insights_week_number", {
      week: date.weekOfYear ?? 0,
    });
  return new Intl.DateTimeFormat(toBcp47(locale), {
    month: "short",
    year: "numeric",
    timeZone: ZONE,
  }).format(
    date.toZonedDateTime({
      timeZone: ZONE,
      plainTime: "12:00",
    }).epochMilliseconds,
  );
}

function bucketRange(
  grain: "week" | "month",
  key: string,
  period: InsightsPeriod,
) {
  const start = Temporal.PlainDate.from(key);
  const rawEnd =
    grain === "week"
      ? start.add({ days: 6 })
      : start.add({ months: 1 }).subtract({ days: 1 });
  const periodStart = Temporal.PlainDate.from(period.from);
  const periodLast = Temporal.PlainDate.from(period.to).subtract({ days: 1 });
  const from =
    Temporal.PlainDate.compare(start, periodStart) < 0
      ? period.from
      : start.toString();
  const toInclusive =
    Temporal.PlainDate.compare(rawEnd, periodLast) > 0
      ? periodLast.toString()
      : rawEnd.toString();
  return { from, toInclusive };
}

function busiestBuckets(
  bookings: InsightsBooking[],
  period: InsightsPeriod,
  limit = 3,
  locale: Locale = DEFAULT_LOCALE,
): InsightsBucket[] {
  const window = { startTime: period.fromMs, endTime: period.toMs };
  const minutes = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const booking of reservationBookings(bookings)) {
    const clip = clipInterval(booking, window);
    if (!clip) continue;
    let t = clip.startTime;
    while (t < clip.endTime) {
      const zoned =
        Temporal.Instant.fromEpochMilliseconds(t).toZonedDateTimeISO(ZONE);
      const weekday = (zoned.dayOfWeek + 6) % 7;
      const hour = zoned.hour;
      const slice = Math.min(60000, clip.endTime - t);
      minutes[weekday][hour] += slice / 60000;
      t += slice;
    }
  }
  const ranked: InsightsBucket[] = [];
  for (let day = 0; day < 7; day++)
    for (let hour = 0; hour < 24; hour++)
      if (minutes[day][hour] > 0)
        ranked.push({
          weekday: translateMessage(locale, WEEKDAY_KEYS[day]!),
          hour: `${String(hour).padStart(2, "0")}:00`,
          reservedHours: hoursFromMs(minutes[day][hour]! * 60000),
        });
  return ranked
    .sort((a, b) => b.reservedHours - a.reservedHours)
    .slice(0, limit);
}

function toRecord(booking: InsightsBooking): InsightsRecord {
  return {
    id: booking.id,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
  };
}
