import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui";
import { today } from "../../shared/time";
import { useFormatters, useT } from "../i18n";
export function MonthCalendar({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (date: string) => void;
  hint?: string;
}) {
  const { t } = useT();
  const { bcp47 } = useFormatters();
  const [month, setMonth] = useState(() => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime())
      ? value.slice(0, 7)
      : today().slice(0, 7);
  });
  const start = new Date(`${month}-01T12:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  const days = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const heading = new Intl.DateTimeFormat(bcp47, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
  const weekdays = [
    t("rooms.weekday_mon"),
    t("rooms.weekday_tue"),
    t("rooms.weekday_wed"),
    t("rooms.weekday_thu"),
    t("rooms.weekday_fri"),
    t("rooms.weekday_sat"),
    t("rooms.weekday_sun"),
  ];
  const move = (delta: number) => {
    const next = new Date(start);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
  };
  return (
    <div className="month-calendar">
      <div className="month-heading">
        <Button
          variant="tertiary"
          icon
          aria-label={t("a11y.previous_month")}
          disabled={month <= today().slice(0, 7)}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span aria-live="polite">{heading}</span>
        <Button
          variant="tertiary"
          icon
          aria-label={t("a11y.next_month")}
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className="month-weekdays" aria-hidden="true">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-days" role="group" aria-label={t("a11y.pick_date")}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={date}
              aria-label={new Intl.DateTimeFormat(bcp47, {
                dateStyle: "full",
                timeZone: "UTC",
              }).format(new Date(`${date}T12:00:00Z`))}
              aria-pressed={value === date}
              disabled={date < today()}
              className={date === today() ? "is-today" : ""}
              onClick={() => onChange(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="caption">{hint ?? t("rooms.calendar_availability_hint")}</p>
    </div>
  );
}
