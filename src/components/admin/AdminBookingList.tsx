import { useEffect, useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Booking, Room } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";
import { Button } from "../ui";
import { adminBookingListColumns, toAdminBookingRow } from "./adminBookingRow";
import {
  AdminBookingColumnHeader,
  AdminBookingRowView,
} from "./AdminBookingRowView";

const PAGE_SIZE = 10;

export function AdminBookingList({
  bookings,
  rooms,
  busy,
  pageSize = PAGE_SIZE,
  onOpen,
  onApprove,
  onReject,
  onCancel,
}: {
  bookings: Booking[];
  rooms: Room[];
  busy?: boolean;
  /** Set to 0 to show every row (e.g. short overview preview). */
  pageSize?: number;
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
      busy,
    }),
  );
  const paginate = pageSize > 0 && rows.length > pageSize;
  const pageCount = paginate ? Math.ceil(rows.length / pageSize) : 1;
  const [page, setPage] = useState(0);
  const listKey = bookings.map((booking) => booking.id).join(",");

  useEffect(() => {
    setPage(0);
  }, [listKey]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount - 1);
  const start = paginate ? safePage * pageSize : 0;
  const end = paginate ? start + pageSize : rows.length;
  const visible = rows.slice(start, end);
  const from = rows.length === 0 ? 0 : start + 1;
  const to = Math.min(end, rows.length);

  return (
    <div className="admin-bl-list">
      <AdminBookingColumnHeader columns={adminBookingListColumns(t)} />
      {visible.map((row, index) => {
        const globalIndex = start + index;
        const showFinishedDivider =
          row.finished &&
          (globalIndex === 0 || !rows[globalIndex - 1]!.finished);
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
      {paginate ? (
        <nav
          className="admin-bl-pagination"
          aria-label={t("admin.bookings_pagination_aria")}
        >
          <p className="admin-bl-pagination-status" aria-live="polite">
            {t("admin.bookings_page_status", {
              from,
              to,
              total: rows.length,
            })}
          </p>
          <div className="admin-bl-pagination-actions">
            <Button
              type="button"
              variant="secondary"
              data-size="sm"
              disabled={safePage <= 0}
              aria-label={t("admin.bookings_previous")}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t("admin.bookings_previous")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-size="sm"
              disabled={safePage >= pageCount - 1}
              aria-label={t("admin.bookings_next")}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              {t("admin.bookings_next")}
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
