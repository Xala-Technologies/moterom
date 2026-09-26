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
  onCancel,
}: {
  bookings: Booking[];
  rooms: Room[];
  busy?: boolean;
  onOpen: (booking: Booking) => void;
  onApprove?: (booking: Booking) => void;
  onReject?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
}): ReactElement {
  const { t } = useT();
  const formatters = useFormatters();
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const rows = bookings.map((booking) =>
    toAdminBookingRow(booking, {
      t,
      formatters,
      room: roomById.get(booking.roomId),
      canApprove: Boolean(onApprove),
      canReject: Boolean(onReject),
      canCancel: Boolean(onCancel),
      canMessage: true,
      canCalendar: true,
      busy,
    }),
  );

  return (
    <div className="admin-bl-list">
      <AdminBookingColumnHeader columns={adminBookingListColumns(t)} />
      {rows.map((row, index) => {
        const showFinishedDivider =
          row.finished && (index === 0 || !rows[index - 1]!.finished);
        return (
          <div key={row.id} className="admin-bl-entry">
            {showFinishedDivider ? (
              <div
                className="admin-bl-finished-divider"
                role="separator"
                aria-label={t("admin.bookings_finished")}
              >
                <span>{t("admin.bookings_finished")}</span>
              </div>
            ) : null}
            <AdminBookingRowView
              row={row}
              busy={busy}
              onView={(id) => {
                const match = bookings.find((entry) => entry.id === id);
                if (match) onOpen(match);
              }}
              onAction={(id, action) => {
                const match = bookings.find((entry) => entry.id === id);
                if (!match) return;
                if (action === "approve") onApprove?.(match);
                if (action === "reject") onReject?.(match);
                if (action === "cancel") onCancel?.(match);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
