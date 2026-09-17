import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api";
import type { TimeSlot } from "../../shared/types";
import { Loading, ErrorState, Button } from "./ui";
import { useT } from "../i18n";

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
  const dateId = `room-date-${roomId}`;
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

  return (
    <div
      className="room-schedule"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="room-schedule-date">
        <label htmlFor={dateId}>{t("common.date")}</label>
        <input
          id={dateId}
          type="date"
          value={date}
          onChange={(e) => {
            onDateChange(e.target.value);
            onSelect(null);
          }}
        />
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
