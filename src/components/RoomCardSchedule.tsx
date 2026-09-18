import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useApi } from "../api";
import type { TimeSlot } from "../../shared/types";
import { Loading, ErrorState, Button } from "./ui";
import { MonthCalendar } from "./MonthCalendar";
import { useFormatters, useT } from "../i18n";

export type RoomSlotSelection = {
  date: string;
  start: string;
  end: string;
};

export function RoomCardSchedule({
  roomId,
  date,
  onDateChange,
  selection,
  onSelect,
  onBook,
  moreHref,
  slotsRevision = 0,
}: {
  roomId: string;
  date: string;
  onDateChange: (date: string) => void;
  selection: RoomSlotSelection | null;
  onSelect: (next: RoomSlotSelection | null) => void;
  onBook: () => void;
  moreHref: string;
  slotsRevision?: number;
}) {
  const { t } = useT();
  const { displayDate } = useFormatters();
  const dateId = `room-date-${roomId}`;
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const slots = useApi<TimeSlot[]>(
    date
      ? `/availability/slots?date=${encodeURIComponent(date)}&roomId=${encodeURIComponent(roomId)}`
      : null,
  );
  useEffect(() => {
    if (slotsRevision > 0) slots.reload();
    // Reload only when parent bumps revision after a successful booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slots.reload is stable
  }, [slotsRevision]);
  const selected =
    selection &&
    selection.date === date &&
    slots.data?.find(
      (slot) =>
        slot.start === selection.start &&
        slot.end === selection.end &&
        slot.state === "available",
    );
  const canBook = Boolean(selected);
  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById(panelId);
    const items = () =>
      [
        ...(panel?.querySelectorAll<HTMLElement>("button:not([disabled])") ??
          []),
      ].filter((el) => el.getClientRects().length > 0);
    const selectedDay = panel?.querySelector<HTMLElement>(
      'button[aria-pressed="true"]',
    );
    (selectedDay && !selectedDay.hasAttribute("disabled")
      ? selectedDay
      : items()[0]
    )?.focus();
    panel?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, panelId]);

  return (
    <div
      className="room-schedule"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="room-schedule-date" ref={rootRef}>
        <label htmlFor={dateId}>{t("common.date")}</label>
        <button
          ref={triggerRef}
          id={dateId}
          type="button"
          className="room-date-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="dialog"
          aria-label={
            date
              ? `${t("common.date")}: ${displayDate(date, true)}`
              : t("a11y.pick_date")
          }
          onClick={() => setOpen((current) => !current)}
        >
          <span>{date ? displayDate(date, true) : t("a11y.pick_date")}</span>
          <CalendarDays aria-hidden size={20} />
        </button>
        {open && (
          <div
            id={panelId}
            className="room-date-popover"
            role="dialog"
            aria-label={t("a11y.pick_date")}
          >
            <MonthCalendar
              value={date}
              onChange={(next) => {
                onDateChange(next);
                onSelect(null);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            />
          </div>
        )}
      </div>
      {!date ? (
        <p className="muted" role="status">
          {t("rooms.pick_date_for_slots")}
        </p>
      ) : slots.loading ? (
        <Loading label={t("booking.checking_slots")} />
      ) : slots.error ? (
        <ErrorState error={slots.error} retry={slots.reload} />
      ) : (
        <>
          <div
            className="room-schedule-slots"
            role="group"
            aria-label={t("a11y.available_times")}
          >
            {(slots.data || []).map((slot) => {
              const label = `${slot.start}–${slot.end}`;
              const pressed =
                Boolean(selection) &&
                selection!.date === date &&
                selection!.start === slot.start &&
                selection!.end === slot.end;
              return (
                <button
                  type="button"
                  key={slot.start}
                  className={
                    slot.state === "available"
                      ? pressed
                        ? "is-selected"
                        : "is-available"
                      : slot.state === "error"
                        ? "is-unknown"
                        : "is-unavailable"
                  }
                  aria-pressed={pressed}
                  aria-label={
                    slot.state === "available"
                      ? pressed
                        ? t("a11y.slot_selected", { label })
                        : label
                      : slot.state === "error"
                        ? t("a11y.slot_unknown", { label })
                        : t("a11y.slot_unavailable", { label })
                  }
                  disabled={slot.state !== "available"}
                  onClick={() => {
                    if (
                      pressed ||
                      (selection?.date === date &&
                        selection.start === slot.start &&
                        selection.end === slot.end)
                    ) {
                      onSelect(null);
                      return;
                    }
                    onSelect({ date, start: slot.start, end: slot.end });
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {slots.data?.every((slot) => slot.state !== "available") && (
            <p className="muted" role="status">
              {t("booking.no_slots")}
            </p>
          )}
        </>
      )}
      <div className="room-schedule-actions">
        <Link className="room-more-options" to={moreHref}>
          {t("rooms.more_options")}
        </Link>
        <Button
          type="button"
          data-size="sm"
          disabled={!canBook}
          onClick={onBook}
        >
          {t("rooms.book_selected")}
        </Button>
      </div>
    </div>
  );
}
