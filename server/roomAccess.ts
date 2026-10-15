import type { Room, User } from "../shared/types";
import { AppError } from "../shared/validation";
import type { OrganizationStore } from "./organizations";

/** Internal-only rooms require internal/member entitlement or admin. */
export function canAccessRoom(
  room: Room,
  user: User | undefined,
  orgs?: OrganizationStore,
): boolean {
  if (!room.internalOnly) return true;
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.priceGroup === "internal" || user.priceGroup === "member")
    return true;
  if (!orgs) return false;
  for (const m of orgs.approvedMembershipsForUser(user.id)) {
    const org = orgs.getOrganization(m.organizationId);
    if (!org) continue;
    if (org.isInternalTenant) return true;
    if (orgs.approvedMemberOfInternal(org.id)) return true;
  }
  return false;
}

export function assertCanAccessRoom(
  room: Room,
  user: User | undefined,
  orgs?: OrganizationStore,
) {
  if (canAccessRoom(room, user, orgs)) return;
  throw new AppError(
    403,
    "Dette rommet er bare tilgjengelig for interne.",
    "room_internal_only",
  );
}

export function filterRoomsForUser(
  rooms: Room[],
  user: User | undefined,
  orgs?: OrganizationStore,
): Room[] {
  return rooms.filter((room) => canAccessRoom(room, user, orgs));
}
