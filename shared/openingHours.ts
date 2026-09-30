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

/** Normalize HH:mm or HH:mm:ss to HH:mm, or undefined if invalid. */
export function normalizeClockTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!TIME_RE.test(trimmed)) return undefined;
  const hour = Number(trimmed.slice(0, 2));
  const minute = Number(trimmed.slice(3, 5));
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidClockTime(value: string): boolean {
  return normalizeClockTime(value) !== undefined;
}

/** Minutes from midnight for HH:mm comparison. */
export function clockToMinutes(value: string): number {
  const normalized = normalizeClockTime(value) ?? value;
  return Number(normalized.slice(0, 2)) * 60 + Number(normalized.slice(3, 5));
}

/**
 * Build Digilist-style opening hours: Mon–Fri open/close, Sat/Sun closed.
 * Callers must validate open/close first.
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
