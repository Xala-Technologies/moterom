import type { AccessRequestStatus } from "../../../shared/types";

/** Open on Alle when there is nobody waiting, so treated requests stay visible. */
export function openingAccessFilter(
  rows: { status: AccessRequestStatus }[],
): "all" | AccessRequestStatus {
  if (rows.length > 0 && !rows.some((row) => row.status === "pending")) {
    return "all";
  }
  return "pending";
}
