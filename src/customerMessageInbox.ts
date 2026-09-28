import type { Booking, ConversationSummary } from "../shared/types";
import { compareUpcoming, isOpenBooking } from "../shared/bookingOrder";

/** Keep open bookings visible in the customer inbox even before the first message. */
export function mergeCustomerMessageInbox(
  inbox: ConversationSummary[],
  bookings: Booking[],
  emptyPreview: string,
): ConversationSummary[] {
  const support = inbox.filter((row) => row.kind === "support");
  const bookingInbox = inbox.filter((row) => row.kind === "booking");
  const byBookingId = new Map(
    bookingInbox
      .filter((row) => row.bookingId)
      .map((row) => [row.bookingId!, row]),
  );

  const openBookings = bookings
    .filter((booking) => isOpenBooking(booking))
    .sort(compareUpcoming);

  const openRows: ConversationSummary[] = openBookings.map((booking) => {
    const existing = byBookingId.get(booking.id);
    if (existing) return existing;
    return {
      id: `booking:${booking.id}`,
      kind: "booking",
      bookingId: booking.id,
      roomId: booking.roomId,
      roomName: booking.roomName,
      subject: booking.roomName,
      preview: emptyPreview,
      updatedAt: booking.startTime,
      unread: 0,
      customerName: booking.name,
      canAttachImages: true,
      context: {
        roomId: booking.roomId,
        roomName: booking.roomName,
        bookingId: booking.id,
        reference: booking.reference,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    };
  });

  const openIds = new Set(openBookings.map((booking) => booking.id));
  const pastWithMessages = bookingInbox.filter(
    (row) => row.bookingId && !openIds.has(row.bookingId),
  );

  return [...support, ...openRows, ...pastWithMessages].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function conversationSelectionKey(row: ConversationSummary): string {
  if (row.kind === "booking" && row.bookingId) return row.bookingId;
  return row.id;
}

export function findConversation(
  rows: ConversationSummary[],
  selected: string | undefined,
): ConversationSummary | undefined {
  if (!selected) return undefined;
  return rows.find(
    (row) =>
      row.id === selected ||
      row.bookingId === selected ||
      (selected.startsWith("booking:") &&
        row.bookingId === selected.slice("booking:".length)),
  );
}

export function threadEndpoint(row: ConversationSummary): string {
  if (row.kind === "booking" && row.bookingId) {
    return `/bookings/${encodeURIComponent(row.bookingId)}/messages`;
  }
  return `/messages/${encodeURIComponent(row.id)}`;
}

export type MessageReadFilter = "all" | "unread" | "read";
export type MessageKindFilter = "all" | "booking" | "support";

export function matchesCustomerMessageQuery(
  row: ConversationSummary,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.roomName, row.subject, row.preview, row.kind]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function filterCustomerMessageInbox(
  rows: ConversationSummary[],
  options: {
    query: string;
    read: MessageReadFilter;
    kind: MessageKindFilter;
  },
): ConversationSummary[] {
  return rows.filter((row) => {
    if (options.kind !== "all" && row.kind !== options.kind) return false;
    if (options.read === "unread" && row.unread <= 0) return false;
    if (options.read === "read" && row.unread > 0) return false;
    return matchesCustomerMessageQuery(row, options.query);
  });
}
