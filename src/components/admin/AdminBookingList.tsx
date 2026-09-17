import type { ReactElement } from "react";
import type { Booking, Room } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";
import { adminBookingListColumns, toAdminBookingRow } from "./adminBookingRow";
import {
  AdminBookingColumnHeader,
  AdminBookingRowView,
} from "./AdminBookingRowView";

export function AdminBookingList({
  bookings,
  rooms,
  busy,
  onOpen,
  onApprove,
  onReject,
}: {
  bookings: Booking[];
  rooms: Room[];
  busy?: boolean;
  onOpen: (booking: Booking) => void;
  onApprove?: (booking: Booking) => void;
  onReject?: (booking: Booking) => void;
}): ReactElement {
  const { t } = useT();
  const formatters = useFormatters();
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return (
    <div className="admin-bl-list">
      <AdminBookingColumnHeader columns={adminBookingListColumns(t)} />
      {bookings.map((booking) => {
        const row = toAdminBookingRow(booking, {
          t,
          formatters,
          room: roomById.get(booking.roomId),
          canApprove: Boolean(onApprove),
          canReject: Boolean(onReject),
          busy,
        });
        return (
          <AdminBookingRowView
            key={booking.id}
            row={row}
            onView={(id) => {
              const match = bookings.find((entry) => entry.id === id);
              if (match) onOpen(match);
            }}
            onAction={(id, action) => {
              const match = bookings.find((entry) => entry.id === id);
              if (!match) return;
              if (action === "approve") onApprove?.(match);
              if (action === "reject") onReject?.(match);
            }}
          />
        );
      })}
    </div>
  );
}
