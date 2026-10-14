import type { Room, User } from "../shared/types";
import { AppError } from "../shared/validation";

/** Internal-only rooms (e.g. Bakgården) require an approved internal price group. */
export function canAccessRoom(room: Room, user: User | undefined): boolean {
  if (!room.internalOnly) return true;
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.priceGroup === "internal";
}

export function assertCanAccessRoom(room: Room, user: User | undefined) {
  if (canAccessRoom(room, user)) return;
  throw new AppError(
    403,
    "Dette rommet er bare tilgjengelig for interne.",
    "room_internal_only",
  );
}

export function filterRoomsForUser(
  rooms: Room[],
  user: User | undefined,
): Room[] {
  return rooms.filter((room) => canAccessRoom(room, user));
}
