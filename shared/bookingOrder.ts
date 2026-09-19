export type OrderedBooking = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
};

const CLOSED = new Set(["cancelled", "rejected"]);

export function isOpenBooking(booking: OrderedBooking, now = Date.now()) {
  return booking.endTime >= now && !CLOSED.has(booking.status);
}

function byId(a: OrderedBooking, b: OrderedBooking) {
  return a.id.localeCompare(b.id);
}

/** Next meeting first. Same start keeps a stable id order. */
export function compareUpcoming(a: OrderedBooking, b: OrderedBooking) {
  return a.startTime - b.startTime || byId(a, b);
}

/** Most recent meeting first. */
export function compareHistory(a: OrderedBooking, b: OrderedBooking) {
  return b.startTime - a.startTime || byId(a, b);
}

/**
 * Actionable rows first (pending), then the next open meeting, then closed
 * history with the most recent date first.
 */
export function compareAgenda(
  a: OrderedBooking,
  b: OrderedBooking,
  now = Date.now(),
) {
  const rank = (booking: OrderedBooking) => {
    if (booking.status === "pending") return 0;
    if (isOpenBooking(booking, now)) return 1;
    return 2;
  };
  const difference = rank(a) - rank(b);
  if (difference) return difference;
  return rank(a) === 2 ? compareHistory(a, b) : compareUpcoming(a, b);
}
