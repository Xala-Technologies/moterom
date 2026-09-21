import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Clock3, DoorOpen } from "lucide-react";
import type { Room, Search } from "../../../shared/types";
import { suggestedSlots } from "../../../shared/time";
import { MonthCalendar } from "../MonthCalendar";
import { useFormatters, useT } from "../../i18n";
import { Field, Input, Label } from "../ui";
import { FilterSelect } from "./FilterSelect";

export function BlockTimeForm({
  rooms,
  roomId,
  onRoom,
  value,
  onChange,
  title,
  onTitle,
}: {
  rooms: Room[];
  roomId: string;
  onRoom: (roomId: string) => void;
  value: Search;
  onChange: (value: Search) => void;
  title: string;
  onTitle: (title: string) => void;
}) {
  const { t } = useT();
  const { displayDate } = useFormatters();
  const datePanelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const slots = suggestedSlots();
  const starts = slots.map((slot) => slot.start);
  const ends = slots.map((slot) => slot.end).filter((end) => end > value.start);

  useEffect(() => {
    if (!dateOpen) return;
    const panel = document.getElementById(datePanelId);
    const selected = panel?.querySelector<HTMLElement>(
      'button[aria-pressed="true"]:not([disabled])',
    );
    selected?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setDateOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target))
        return;
      setDateOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [dateOpen, datePanelId]);

  const setStart = (start: string) => {
    const fallback =
      slots.find((slot) => slot.start === start)?.end ?? value.end;
    onChange({
      ...value,
      start,
      end: value.end > start ? value.end : fallback,
      people: 1,
    });
  };

  return (
    <>
      <Field>
        <Label>{t("common.room")}</Label>
        <FilterSelect
          label={t("common.room")}
          value={roomId}
          onChange={onRoom}
          options={rooms.map((room) => ({
            value: room.id,
            label: room.name,
            icon: <DoorOpen size={18} />,
          }))}
        />
      </Field>
      <Field>
        <Label>{t("common.date")}</Label>
        <div className="block-date" ref={rootRef}>
          <button
            ref={triggerRef}
            type="button"
            className="room-date-trigger"
            aria-expanded={dateOpen}
            aria-controls={datePanelId}
            aria-haspopup="dialog"
            aria-label={`${t("common.date")}: ${displayDate(value.date, true)}`}
            onClick={() => setDateOpen((open) => !open)}
          >
            <span>{displayDate(value.date, true)}</span>
            <CalendarDays aria-hidden size={20} />
          </button>
          {dateOpen && (
            <div
              id={datePanelId}
              className="room-date-popover"
              role="dialog"
              aria-label={t("a11y.pick_date")}
            >
              <MonthCalendar
                value={value.date}
                hint={t("admin.block_date_hint")}
                onChange={(date) => {
                  onChange({ ...value, date, people: 1 });
                  setDateOpen(false);
                  triggerRef.current?.focus();
                }}
              />
            </div>
          )}
        </div>
      </Field>
      <div className="block-times">
        <Field>
          <Label>{t("common.time_from")}</Label>
          <FilterSelect
            label={t("common.time_from")}
            value={value.start}
            onChange={setStart}
            options={starts.map((start) => ({
              value: start,
              label: start,
              icon: <Clock3 size={18} />,
            }))}
          />
        </Field>
        <Field>
          <Label>{t("common.time_to")}</Label>
          <FilterSelect
            label={t("common.time_to")}
            value={
              ends.includes(value.end) ? value.end : (ends[0] ?? value.end)
            }
            onChange={(end) => onChange({ ...value, end, people: 1 })}
            options={ends.map((end) => ({
              value: end,
              label: end,
              icon: <Clock3 size={18} />,
            }))}
          />
        </Field>
      </div>
      <Field>
        <Label>{t("admin.reason")}</Label>
        <Input
          aria-label={t("admin.reason")}
          value={title}
          maxLength={120}
          required
          placeholder={t("admin.reason_placeholder")}
          onChange={(event) => onTitle(event.target.value)}
        />
      </Field>
    </>
  );
}
