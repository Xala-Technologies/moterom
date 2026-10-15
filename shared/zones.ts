/**
 * Physical hall zones for Frivillighetens Hus demo.
 * Conflict authority lives on the server — never accept zone maps from the client.
 * The UI may read this map only for the illustrative stripe (selected ≠ busy).
 */
export const SAL_ZONES: Record<string, readonly string[]> = {
  "sal-1": ["sal-1"],
  "sal-2": ["sal-2"],
  "sal-3": ["sal-3"],
  "sal-1-2": ["sal-1", "sal-2"],
  "sal-1-3": ["sal-1", "sal-2", "sal-3"],
};

/** Physical segments shown in the halls stripe (not combination products). */
export const PHYSICAL_SAL_ZONES = ["sal-1", "sal-2", "sal-3"] as const;

export const SAL_ROOM_IDS = Object.keys(SAL_ZONES);

export function isSalRoom(roomId: string): boolean {
  return roomId in SAL_ZONES;
}

export function zonesForProduct(roomId: string): readonly string[] {
  return SAL_ZONES[roomId] ?? [];
}

/** Zones marked “selected” in the UX stripe for a product filter (not occupancy). */
export function selectedPhysicalZones(productId: string): ReadonlySet<string> {
  if (productId === "all") return new Set();
  return new Set(zonesForProduct(productId));
}

/** True when two bookable products share physical floor area. */
export function zonesOverlap(roomA: string, roomB: string): boolean {
  const a = SAL_ZONES[roomA];
  const b = SAL_ZONES[roomB];
  if (!a || !b) return roomA === roomB;
  return a.some((zone) => b.includes(zone));
}
