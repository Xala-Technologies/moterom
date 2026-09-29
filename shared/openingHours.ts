export type PortalOpeningHour = {
  dayIndex: number;
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
};

const TIME_RE = /^\d{2}:\d{2}$/;

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

export function isValidClockTime(value: string): boolean {
  if (!TIME_RE.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/** Minutes from midnight for HH:mm comparison. */
export function clockToMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/**
 * Build Digilist-style opening hours: Mon–Fri open/close, Sat/Sun closed.
 * Callers must validate open/close first.
 */
export function buildPortalOpeningHours(
  open: string,
  close: string,
): PortalOpeningHour[] {
  return [
    ...WEEKDAYS.map((day) => ({
      ...day,
      open,
      close,
    })),
    ...WEEKEND.map((day) => ({
      ...day,
      open: "00:00",
      close: "00:00",
      isClosed: true as const,
    })),
  ];
}

/** Prefer the first open weekday window from Digilist openingHours. */
export function weekdayWindowFromOpeningHours(
  hours: unknown,
): { openTime: string; closeTime: string } | undefined {
  if (!Array.isArray(hours)) return undefined;
  for (const entry of hours) {
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
    const open = typeof row.open === "string" ? row.open.trim() : "";
    const close = typeof row.close === "string" ? row.close.trim() : "";
    if (!isValidClockTime(open) || !isValidClockTime(close)) continue;
    if (clockToMinutes(open) >= clockToMinutes(close)) continue;
    return { openTime: open, closeTime: close };
  }
  return undefined;
}
