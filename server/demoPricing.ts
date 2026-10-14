import type { Room, Search, User } from "../shared/types";
import { interval } from "../shared/time";

/** Approved demo price groups — never taken from the client body. */
export type DemoPriceGroup = "internal" | "external";

export function demoPriceGroup(user: User | undefined): DemoPriceGroup {
  return user?.priceGroup === "internal" ? "internal" : "external";
}

export function hoursForSearch(search: Pick<Search, "date" | "start" | "end">) {
  const { startTime, endTime } = interval(search);
  return (endTime - startTime) / (60 * 60 * 1000);
}

/** Demo quote total from room ladder + session price group. Zero when no ladder. */
export function demoQuoteTotal(
  room: Room,
  search: Pick<Search, "date" | "start" | "end">,
  user: User | undefined,
): number {
  const ladder = room.demoHourlyPrices;
  if (!ladder) return 0;
  const group = demoPriceGroup(user);
  const rate = group === "internal" ? ladder.internal : ladder.external;
  return Math.round(rate * hoursForSearch(search));
}
