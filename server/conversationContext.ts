import type {
  Booking,
  ConversationContext,
  ConversationSummary,
  Room,
} from "../shared/types";

export function conversationContext(
  booking: Booking,
  room?: Room,
): ConversationContext {
  return {
    roomId: booking.roomId,
    roomName: room?.name || booking.roomName,
    image: room?.image,
    imageKind: room?.imageKind,
    capacity: room?.capacity,
    capacityLabel: room?.capacityLabel,
    capacityLabelEn: room?.capacityLabelEn,
    bookingId: booking.id,
    reference: booking.reference,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
  };
}

export function enrichBookingConversation(
  conversation: ConversationSummary,
  booking: Booking | undefined,
  rooms: Room[],
): ConversationSummary {
  if (!booking) {
    return {
      ...conversation,
      kind: conversation.kind || "booking",
    };
  }
  const room = rooms.find((r) => r.id === booking.roomId);
  return {
    ...conversation,
    kind: "booking",
    bookingId: booking.id,
    roomId: booking.roomId,
    roomName: room?.name || booking.roomName || conversation.roomName,
    context: conversationContext(booking, room),
  };
}
