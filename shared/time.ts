import { Temporal } from "@js-temporal/polyfill";
import type { Search } from "./types";
import { DEFAULT_LOCALE, toBcp47, type Locale } from "./i18n/locale";
import { translateMessage } from "./i18n/messages";
export const ZONE = "Europe/Oslo";
export function today() {
  return Temporal.Now.plainDateISO(ZONE).toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function interval(
  search: Pick<Search, "date" | "start" | "end">,
  locale: Locale = DEFAULT_LOCALE,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(search.date) ||
    !/^\d{2}:\d{2}$/.test(search.start) ||
    !/^\d{2}:\d{2}$/.test(search.end)
  )
    throw new Error(translateMessage(locale, "invalid_datetime"));
  const parse = (time: string) =>
    Temporal.PlainDateTime.from(`${search.date}T${time}`).toZonedDateTime(
      ZONE,
      { disambiguation: "reject" },
    ).epochMilliseconds;
  let startTime: number, endTime: number;
  try {
    startTime = parse(search.start);
    endTime = parse(search.end);
  } catch {
    throw new Error(translateMessage(locale, "dst_ambiguous"));
  }
  if (endTime <= startTime)
    throw new Error(translateMessage(locale, "end_after_start_same_day"));
  return { startTime, endTime };
}
export const overlaps = (
  a: { startTime: number; endTime: number },
  b: { startTime: number; endTime: number },
) => a.startTime < b.endTime && a.endTime > b.startTime;
export const shortTime = (ms: number, locale: Locale = DEFAULT_LOCALE) =>
  new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
export const displayDate = (
  date: string | number,
  long = false,
  locale: Locale = DEFAULT_LOCALE,
) =>
  new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone: ZONE,
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
  }).format(
    typeof date === "number"
      ? date
      : interval({ date, start: "12:00", end: "13:00" }, locale).startTime,
  );
export function toSearch(
  startTime: number,
  endTime: number,
  people = 1,
): Search {
  const start =
    Temporal.Instant.fromEpochMilliseconds(startTime).toZonedDateTimeISO(ZONE);
  const end =
    Temporal.Instant.fromEpochMilliseconds(endTime).toZonedDateTimeISO(ZONE);
  return {
    date: start.toPlainDate().toString(),
    start: start.toPlainTime().toString().slice(0, 5),
    end: end.toPlainTime().toString().slice(0, 5),
    people,
  };
}
export const money = (
  amount: number | null,
  currency = "NOK",
  locale: Locale = DEFAULT_LOCALE,
) =>
  amount === null
    ? translateMessage(locale, "price_on_request")
    : amount === 0
      ? translateMessage(locale, "no_payment")
      : new Intl.NumberFormat(toBcp47(locale), {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(amount);
export function defaultSearch(): Search {
  return { date: addDays(today(), 1), start: "09:00", end: "10:00", people: 1 };
}
function clock(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
/** Portal one-hour suggestions, not Digilist opening hours. */
export function suggestedSlots() {
  return Array.from({ length: 9 }, (_, i) => {
    const start = 8 + i;
    return { start: clock(start), end: clock(start + 1) };
  });
}
export function searchParams(search: Search) {
  return new URLSearchParams({
    date: search.date,
    start: search.start,
    end: search.end,
    people: String(search.people),
  }).toString();
}
export function osloDateFromMs(ms: number) {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(ZONE)
    .toPlainDate()
    .toString();
}
export function osloDayStart(date: string) {
  return Temporal.PlainDateTime.from(`${date}T00:00`).toZonedDateTime(ZONE)
    .epochMilliseconds;
}
export function osloDayRange(fromDate: string, toDateExclusive: string) {
  return {
    startTime: osloDayStart(fromDate),
    endTime: osloDayStart(toDateExclusive),
  };
}
export function eachOsloDate(fromDate: string, toDateExclusive: string) {
  const dates: string[] = [];
  let date = Temporal.PlainDate.from(fromDate);
  const end = Temporal.PlainDate.from(toDateExclusive);
  while (Temporal.PlainDate.compare(date, end) < 0) {
    dates.push(date.toString());
    date = date.add({ days: 1 });
  }
  return dates;
}
export function osloMonday(date: string) {
  const value = Temporal.PlainDate.from(date);
  return value.subtract({ days: (value.dayOfWeek + 6) % 7 }).toString();
}
export function osloMonthStart(date: string) {
  return Temporal.PlainDate.from(date).with({ day: 1 }).toString();
}
export function clipInterval(
  a: { startTime: number; endTime: number },
  b: { startTime: number; endTime: number },
) {
  const startTime = Math.max(a.startTime, b.startTime);
  const endTime = Math.min(a.endTime, b.endTime);
  return endTime > startTime ? { startTime, endTime } : undefined;
}
export const hoursFromMs = (ms: number) => Math.round(ms / 360000) / 10;
export const formatHours = (hours: number, locale: Locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(toBcp47(locale), {
    maximumFractionDigits: 1,
  }).format(hours);
export const formatCount = (value: number, locale: Locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(toBcp47(locale)).format(value);
