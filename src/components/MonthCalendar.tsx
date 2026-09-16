import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui";
import { today } from "../../shared/time";
export function MonthCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
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
  const heading = new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
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
          aria-label="Forrige måned"
          disabled={month <= today().slice(0, 7)}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span aria-live="polite">{heading}</span>
        <Button
          variant="tertiary"
          icon
          aria-label="Neste måned"
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className="month-weekdays" aria-hidden="true">
        {["ma", "ti", "on", "to", "fr", "lø", "sø"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-days" role="group" aria-label="Velg dato">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={date}
              aria-label={new Intl.DateTimeFormat("nb-NO", {
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
      <p className="caption">Ledighet sjekkes for valgt dato og tid.</p>
    </div>
  );
}
