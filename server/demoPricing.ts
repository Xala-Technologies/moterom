import type { PriceCategory, Room, Search, User } from "../shared/types";
import { interval } from "../shared/time";
import { rateForCategory } from "./orgEntitlements";

/** @deprecated Prefer PriceCategory; kept for call sites during migration. */
export type DemoPriceGroup = PriceCategory;

export function demoPriceGroup(user: User | undefined): PriceCategory {
  const g = user?.priceGroup;
  if (g === "internal" || g === "member" || g === "ideal") return g;
  return "external";
}

export function hoursForSearch(search: Pick<Search, "date" | "start" | "end">) {
  const { startTime, endTime } = interval(search);
  return (endTime - startTime) / (60 * 60 * 1000);
}

/** Demo quote total from room ladder + session price group (no org selected). */
export function demoQuoteTotal(
  room: Room,
  search: Pick<Search, "date" | "start" | "end">,
  user: User | undefined,
): number {
  const ladder = room.demoHourlyPrices;
  if (!ladder) return 0;
  const group = demoPriceGroup(user);
  const rate = rateForCategory(room, group) ?? ladder.external;
  return Math.round(rate * hoursForSearch(search));
}
