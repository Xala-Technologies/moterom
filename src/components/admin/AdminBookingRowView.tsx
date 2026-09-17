import type { KeyboardEvent, ReactElement } from "react";
import { useState } from "react";
import type {
  AdminBookingActionId,
  AdminBookingListColumns,
  AdminBookingRow,
} from "./adminBookingRow";

function Thumbnail({
  imageUrl,
  roomName,
}: {
  imageUrl: string | null;
  roomName: string;
}): ReactElement {
  const [failed, setFailed] = useState(false);
  const show = Boolean(imageUrl) && !failed;
  return (
    <div className="admin-bl-thumb">
      {show ? (
        <img
          src={imageUrl ?? undefined}
          alt=""
          className="admin-bl-thumb-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="admin-bl-thumb-fallback" aria-hidden="true">
          {roomName.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

export function AdminBookingColumnHeader({
  columns,
}: {
  columns: AdminBookingListColumns;
}): ReactElement {
  return (
    <div className="admin-bl-header" role="row">
      <span>{columns.resource}</span>
      <span>{columns.schedule}</span>
      <span>{columns.customer}</span>
      <span>{columns.payment}</span>
      <span>{columns.status}</span>
      <span className="admin-bl-header-actions">{columns.actions}</span>
    </div>
  );
}

export function AdminBookingRowView({
  row,
  onView,
  onAction,
}: {
  row: AdminBookingRow;
  onView: (id: string) => void;
  onAction?: (id: string, action: AdminBookingActionId) => void;
}): ReactElement {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onView(row.id);
    }
  };

  const paymentClass =
    row.paymentTone === "unpaid"
      ? "admin-bl-secondary admin-bl-payment-unpaid"
      : "admin-bl-secondary";

  return (
    <div
      className={`admin-bl-row${row.cancelled ? " is-cancelled" : ""}`}
      role="link"
      tabIndex={0}
      onClick={() => onView(row.id)}
      onKeyDown={onKeyDown}
      aria-label={row.openAriaLabel}
    >
      <div className="admin-bl-resource">
        <Thumbnail imageUrl={row.imageUrl} roomName={row.roomName} />
        <div className="admin-bl-resource-text">
          <strong className="admin-bl-title">{row.roomName}</strong>
          <span className="admin-bl-secondary">{row.reference}</span>
        </div>
      </div>
      <div className="admin-bl-col">
        <span className="admin-bl-primary">{row.dateSpanLabel}</span>
        <span className="admin-bl-secondary">{row.timeWithDurationLabel}</span>
      </div>
      <div className="admin-bl-col">
        <span className="admin-bl-primary">{row.customerName}</span>
        {row.customerPhone ? (
          <a
            className="admin-bl-phone"
            href={`tel:${row.customerPhone.replace(/\s+/g, "")}`}
            onClick={(e) => e.stopPropagation()}
          >
            {row.customerPhone}
          </a>
        ) : row.customerEmail ? (
          <span className="admin-bl-secondary">{row.customerEmail}</span>
        ) : null}
      </div>
      <div className="admin-bl-col">
        <span className="admin-bl-primary">{row.paymentAmountLabel}</span>
        {row.paymentStatusLabel ? (
          <span className={paymentClass}>{row.paymentStatusLabel}</span>
        ) : null}
      </div>
      <div className="admin-bl-status">
        <span className={`admin-bl-badge tone-${row.statusTone}`}>
          {row.statusLabel}
        </span>
      </div>
      <div className="admin-bl-actions" onClick={(e) => e.stopPropagation()}>
        {row.actions.length === 0 ? (
          <span className="admin-bl-secondary" aria-hidden="true">
            —
          </span>
        ) : (
          row.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`admin-bl-action tone-${action.tone || "default"}`}
              disabled={action.disabled}
              onClick={() => onAction?.(row.id, action.id)}
            >
              {action.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
