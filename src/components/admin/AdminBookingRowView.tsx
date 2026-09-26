import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import type {
  AdminBookingAction,
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

function BookingActionsMenu({
  label,
  busy,
  actions,
  onAction,
}: {
  label: string;
  busy?: boolean;
  actions: AdminBookingAction[];
  onAction?: (action: AdminBookingActionId) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]',
        ) ?? []),
      ];
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next =
        items[index + direction] ??
        items[direction === 1 ? 0 : items.length - 1];
      next?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  return (
    <div className={`admin-bl-menu${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-bl-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="admin-bl-menu-list"
          role="menu"
        >
          {actions.map((action) => {
            const className =
              action.tone === "danger" ? "is-danger" : undefined;
            if (action.href) {
              const external = action.href.startsWith("/api/");
              if (external) {
                return (
                  <a
                    key={action.id}
                    role="menuitem"
                    className={className}
                    href={action.href}
                    onClick={() => setOpen(false)}
                  >
                    {action.label}
                  </a>
                );
              }
              return (
                <Link
                  key={action.id}
                  role="menuitem"
                  className={className}
                  to={action.href}
                  onClick={() => setOpen(false)}
                >
                  {action.label}
                </Link>
              );
            }
            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={className}
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  onAction?.(action.id);
                }}
              >
                {action.label}
              </button>
            );
          })}
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
      <span>{columns.status}</span>
      <span className="admin-bl-header-actions">{columns.actions}</span>
    </div>
  );
}

export function AdminBookingRowView({
  row,
  onView,
  onAction,
  busy,
}: {
  row: AdminBookingRow;
  onView: (id: string) => void;
  onAction?: (id: string, action: AdminBookingActionId) => void;
  busy?: boolean;
}): ReactElement {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onView(row.id);
    }
  };

  const primary = row.actions.filter((action) => action.primary);
  const menu = row.actions.filter((action) => !action.primary);

  return (
    <div
      className={`admin-bl-row${row.cancelled ? " is-cancelled" : ""}${row.finished ? " is-finished" : ""}`}
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
      <div className="admin-bl-status">
        <span className={`admin-bl-badge tone-${row.statusTone}`}>
          {row.statusLabel}
        </span>
        {row.editRequestedLabel ? (
          <span className="admin-bl-secondary">{row.editRequestedLabel}</span>
        ) : null}
      </div>
      <div className="admin-bl-actions" onClick={(e) => e.stopPropagation()}>
        {primary.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`admin-bl-action tone-${action.tone || "default"}`}
            disabled={action.disabled}
            onClick={() => onAction?.(row.id, action.id)}
          >
            {action.label}
          </button>
        ))}
        {menu.length > 0 ? (
          <BookingActionsMenu
            label={row.actionsMenuAriaLabel}
            busy={busy}
            actions={menu}
            onAction={(action) => onAction?.(row.id, action)}
          />
        ) : primary.length === 0 ? (
          <span className="admin-bl-secondary" aria-hidden="true">
            —
          </span>
        ) : null}
      </div>
    </div>
  );
}
