export type PortalOpeningHour = {
  dayIndex: number;
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
};

const TIME_RE = /^\d{2}:\d{2}(?::\d{2})?$/;

export const DEFAULT_OPEN_TIME = "08:00";
export const DEFAULT_CLOSE_TIME = "17:00";

/**
 * Digilist `validateBookingSlot` still compares UTC `Date#getHours` to opening
 * hour strings on Convex. Europe/Oslo is UTC+1/+2, so the first 1–2 Oslo hours
 * look "outside" hours. Shift Digilist open earlier by the max Oslo offset so
 * portal slots stay bookable; Moteroom keeps the real Fra/Til in metadata.
 */
export const DIGILIST_UTC_OPEN_SKEW_MINUTES = 120;

const WEEKDAYS: { dayIndex: number; day: string }[] = [
  { dayIndex: 1, day: "Mandag" },
  { dayIndex: 2, day: "Tirsdag" },
  { dayIndex: 3, day: "Onsdag" },
  { dayIndex: 4, day: "Torsdag" },
  { dayIndex: 5, day: "Fredag" },
];

const WEEKEND: { dayIndex: number; day: string }[] = [
  { dayIndex: 6, day: "Lørdag" },
  { dayIndex: 0, day: "Søndag" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Normalize HH:mm or HH:mm:ss to HH:mm, or undefined if invalid. */
export function normalizeClockTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!TIME_RE.test(trimmed)) return undefined;
  const hour = Number(trimmed.slice(0, 2));
  const minute = Number(trimmed.slice(3, 5));
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function isValidClockTime(value: string): boolean {
  return normalizeClockTime(value) !== undefined;
}

/** Minutes from midnight for HH:mm comparison. */
export function clockToMinutes(value: string): number {
  const normalized = normalizeClockTime(value) ?? value;
  return Number(normalized.slice(0, 2)) * 60 + Number(normalized.slice(3, 5));
}

function minutesToClock(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

/** Digilist-engine open time padded for Convex UTC `getHours` skew. */
export function digilistEngineOpenTime(openOslo: string): string {
  const open = normalizeClockTime(openOslo);
  if (!open) return DEFAULT_OPEN_TIME;
  return minutesToClock(clockToMinutes(open) - DIGILIST_UTC_OPEN_SKEW_MINUTES);
}

/**
 * Build Digilist-style opening hours: Mon–Fri open/close, Sat/Sun closed.
 * Callers must validate open/close first. Times are Europe/Oslo wall-clock.
 */
export function buildPortalOpeningHours(
  open: string,
  close: string,
): PortalOpeningHour[] {
  const openNorm = normalizeClockTime(open) ?? open;
  const closeNorm = normalizeClockTime(close) ?? close;
  return [
    ...WEEKDAYS.map((day) => ({
      ...day,
      open: openNorm,
      close: closeNorm,
    })),
    ...WEEKEND.map((day) => ({
      ...day,
      open: "00:00",
      close: "00:00",
      isClosed: true as const,
    })),
  ];
}

/**
 * Opening hours written to Digilist for portal rooms: open shifted earlier so
 * Convex UTC hour checks accept the real Oslo Fra time. Close stays Oslo.
 */
export function buildDigilistOpeningHours(
  open: string,
  close: string,
): PortalOpeningHour[] {
  return buildPortalOpeningHours(digilistEngineOpenTime(open), close);
}

function hoursArrayFromUnknown(hours: unknown): unknown[] | undefined {
  if (Array.isArray(hours)) return hours;
  if (!hours || typeof hours !== "object") return undefined;
  const dayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  const rows: unknown[] = [];
  for (const [key, val] of Object.entries(hours as Record<string, unknown>)) {
    const dayIndex = dayMap[key.toLowerCase()];
    if (dayIndex === undefined || !val || typeof val !== "object") continue;
    rows.push({ dayIndex, ...(val as object) });
  }
  return rows.length ? rows : undefined;
}

/** Prefer the first open weekday window from Digilist openingHours. */
export function weekdayWindowFromOpeningHours(
  hours: unknown,
): { openTime: string; closeTime: string } | undefined {
  const list = hoursArrayFromUnknown(hours);
  if (!list) return undefined;
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      dayIndex?: unknown;
      open?: unknown;
      close?: unknown;
      isClosed?: unknown;
    };
    const dayIndex = Number(row.dayIndex);
    if (!Number.isFinite(dayIndex) || dayIndex < 1 || dayIndex > 5) continue;
    if (row.isClosed) continue;
    const open =
      typeof row.open === "string" ? normalizeClockTime(row.open) : undefined;
    const close =
      typeof row.close === "string" ? normalizeClockTime(row.close) : undefined;
    if (!open || !close) continue;
    if (clockToMinutes(open) >= clockToMinutes(close)) continue;
    return { openTime: open, closeTime: close };
  }
  return undefined;
}

/** True when Oslo HH:mm start/end sit inside an open weekday window. */
export function isWithinWeekdayClockWindow(
  start: string,
  end: string,
  openTime: string,
  closeTime: string,
): boolean {
  const startNorm = normalizeClockTime(start);
  const endNorm = normalizeClockTime(end);
  const open = normalizeClockTime(openTime);
  const close = normalizeClockTime(closeTime);
  if (!startNorm || !endNorm || !open || !close) return false;
  if (clockToMinutes(open) >= clockToMinutes(close)) return false;
  return (
    clockToMinutes(startNorm) >= clockToMinutes(open) &&
    clockToMinutes(endNorm) <= clockToMinutes(close)
  );
}
