import type {
  Organization,
  PriceCategory,
  Room,
  Search,
  User,
} from "../shared/types";
import { AppError } from "../shared/validation";
import { hoursForSearch } from "./demoPricing";
import type { OrganizationStore } from "./organizations";

export type PriceRule = "cheapest_valid";

export function priceRule(): PriceRule {
  const raw = (process.env.PRICE_RULE || "cheapest_valid").toLowerCase();
  return raw === "cheapest_valid" ? "cheapest_valid" : "cheapest_valid";
}

const CATEGORY_RANK: PriceCategory[] = [
  "internal",
  "member",
  "ideal",
  "external",
];

/** Categories valid for this org when the user has approved representation. */
export function entitlementsForOrganization(
  store: OrganizationStore,
  org: Organization,
): PriceCategory[] {
  const found = new Set<PriceCategory>();
  if (org.isInternalTenant) found.add("internal");
  if (store.approvedMemberOfInternal(org.id)) found.add("member");
  if (org.registryStatus === "verified" || org.manualIdealEligible) {
    found.add("ideal");
  }
  if (found.size === 0) found.add("external");
  return CATEGORY_RANK.filter((c) => found.has(c));
}

export function pickPriceCategory(
  entitlements: PriceCategory[],
  rule: PriceRule = priceRule(),
): PriceCategory {
  if (!entitlements.length) return "external";
  if (rule === "cheapest_valid") {
    for (const c of CATEGORY_RANK) {
      if (entitlements.includes(c)) return c;
    }
  }
  return entitlements[0] || "external";
}

export function rateForCategory(
  room: Room,
  category: PriceCategory,
): number | undefined {
  const ladder = room.demoHourlyPrices;
  if (!ladder) return undefined;
  if (category === "internal") return ladder.internal;
  if (category === "member") return ladder.member ?? ladder.internal;
  if (category === "ideal") return ladder.ideal;
  return ladder.external;
}

/**
 * Resolve price for a booking on behalf of an organisation.
 * Re-loads membership from the store — never trusts client entitlements.
 */
export function resolveOrgBookingPrice(
  store: OrganizationStore,
  user: User,
  organizationId: string | undefined,
  room: Room,
  search: Pick<Search, "date" | "start" | "end">,
): { category: PriceCategory; total: number; organizationId?: string } {
  const ladder = room.demoHourlyPrices;
  const hours = hoursForSearch(search);

  if (!organizationId) {
    const category: PriceCategory =
      user.priceGroup === "internal" ||
      user.priceGroup === "member" ||
      user.priceGroup === "ideal"
        ? user.priceGroup
        : "external";
    const rate = ladder
      ? (rateForCategory(room, category) ?? ladder.external)
      : 0;
    return { category, total: Math.round(rate * hours) };
  }

  const membership = store.getApprovedMembership(user.id, organizationId);
  if (!membership) {
    throw new AppError(
      403,
      "Du har ikke rett til å booke på vegne av denne organisasjonen.",
      "organization_representation_denied",
    );
  }

  const org = store.getOrganization(organizationId);
  if (!org) {
    throw new AppError(404, "Organisasjonen finnes ikke.", "org_not_found");
  }

  const entitlements = entitlementsForOrganization(store, org);
  const category = pickPriceCategory(entitlements);
  const rate = ladder
    ? (rateForCategory(room, category) ?? ladder.external)
    : 0;
  return {
    category,
    total: Math.round(rate * hours),
    organizationId,
  };
}

/** True when the selected org grants internal room access. */
export function orgGrantsInternalAccess(
  store: OrganizationStore,
  user: User,
  organizationId: string | undefined,
): boolean {
  if (user.isAdmin) return true;
  if (!organizationId) return user.priceGroup === "internal";
  if (!store.getApprovedMembership(user.id, organizationId)) return false;
  const org = store.getOrganization(organizationId);
  if (!org) return false;
  const entitlements = entitlementsForOrganization(store, org);
  return entitlements.includes("internal") || entitlements.includes("member");
}
