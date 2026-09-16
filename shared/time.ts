import { Temporal } from "@js-temporal/polyfill";
import type { Search } from "./types";
export const ZONE = "Europe/Oslo";
export function today() {
  return Temporal.Now.plainDateISO(ZONE).toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function interval(search: Pick<Search, "date" | "start" | "end">) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(search.date) ||
    !/^\d{2}:\d{2}$/.test(search.start) ||
    !/^\d{2}:\d{2}$/.test(search.end)
  )
    throw new Error("Velg en gyldig dato og tid.");
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
    throw new Error(
      "Tidspunktet finnes ikke eller er tvetydig ved overgang til sommer-/vintertid. Velg et annet tidspunkt.",
    );
  }
  if (endTime <= startTime)
    throw new Error("Sluttid må være etter starttid samme dag.");
  return { startTime, endTime };
}
export const overlaps = (
  a: { startTime: number; endTime: number },
  b: { startTime: number; endTime: number },
) => a.startTime < b.endTime && a.endTime > b.startTime;
export const shortTime = (ms: number) =>
  new Intl.DateTimeFormat("nb-NO", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
export const displayDate = (date: string | number, long = false) =>
  new Intl.DateTimeFormat("nb-NO", {
    timeZone: ZONE,
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
  }).format(
    typeof date === "number"
      ? date
      : interval({ date, start: "12:00", end: "13:00" }).startTime,
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
export const money = (amount: number | null, currency = "NOK") =>
  amount === null
    ? "Pris etter avtale"
    : amount === 0
      ? "Ingen betaling"
      : new Intl.NumberFormat("nb-NO", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(amount);
export function defaultSearch(): Search {
  return { date: addDays(today(), 1), start: "09:00", end: "10:00", people: 1 };
}
export function searchParams(search: Search) {
  return new URLSearchParams({
    date: search.date,
    start: search.start,
    end: search.end,
    people: String(search.people),
  }).toString();
}
