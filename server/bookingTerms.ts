/** Demo rental terms — not a full legal document store. */
export const DEMO_TERMS_VERSION = "fhh-demo-terms-2026-10-15";

export function cancelDeadlineDaysForRoom(room: {
  cancelDeadlineDays?: number;
  requiresApproval?: boolean;
  id?: string;
}): number {
  if (
    typeof room.cancelDeadlineDays === "number" &&
    room.cancelDeadlineDays > 0
  )
    return room.cancelDeadlineDays;
  // Halls default to 30 days; small rooms to 5.
  if (room.id?.startsWith("sal-") || room.requiresApproval) return 30;
  return 5;
}
