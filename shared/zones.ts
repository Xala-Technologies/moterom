/**
 * Physical hall zones for Frivillighetens Hus demo.
 * Server-only authority — never accept zone maps from the client.
 */
export const SAL_ZONES: Record<string, readonly string[]> = {
  "sal-1": ["sal-1"],
  "sal-2": ["sal-2"],
  "sal-3": ["sal-3"],
  "sal-1-2": ["sal-1", "sal-2"],
  "sal-1-3": ["sal-1", "sal-2", "sal-3"],
};

export const SAL_ROOM_IDS = Object.keys(SAL_ZONES);

export function isSalRoom(roomId: string): boolean {
  return roomId in SAL_ZONES;
}

/** True when two bookable products share physical floor area. */
export function zonesOverlap(roomA: string, roomB: string): boolean {
  const a = SAL_ZONES[roomA];
  const b = SAL_ZONES[roomB];
  if (!a || !b) return roomA === roomB;
  return a.some((zone) => b.includes(zone));
}
