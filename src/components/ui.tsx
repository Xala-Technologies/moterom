import { useEffect, useRef, type ReactNode } from "react";
import {
  Button,
  Field,
  Input,
  Label,
  Select,
  Spinner,
} from "@digdir/designsystemet-react";
import { AlertCircle, ArrowRight, Check, X } from "lucide-react";
import type { Search } from "../../shared/types";
import { interval, today } from "../../shared/time";
export function Loading({ label = "Henter innhold …" }: { label?: string }) {
  return (
    <div className="state" role="status">
      <Spinner aria-label={label} data-size="md" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error | string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div>
        <p>{typeof error === "string" ? error : error.message}</p>
        {retry && (
          <Button variant="secondary" data-size="sm" onClick={retry}>
            Prøv igjen
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const d = ref.current!;
    d.showModal();
    return () => {
      d.close();
      opener.current?.focus?.();
    };
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "modal-wide" : ""}`}
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <Button variant="tertiary" icon aria-label="Lukk" onClick={close}>
          <X size={22} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    confirmed: "Bekreftet",
    pending: "Venter på godkjenning",
    cancelled: "Kansellert",
    rejected: "Avslått",
    completed: "Fullført",
    reserved: "Reservert",
    blocked: "Blokkert",
  };
  const tone = ["confirmed", "completed"].includes(status)
    ? "success"
    : status === "pending"
      ? "warning"
      : status === "blocked"
        ? "blocked"
        : "neutral";
  return (
    <span className={`status status-${tone}`}>
      {status === "confirmed" ? (
        <Check size={13} />
      ) : (
        <span className="status-dot" />
      )}
      {labels[status] || status}
    </span>
  );
}
export function SearchFields({
  value,
  onChange,
  compact = false,
  minDate = today(),
}: {
  value: Search;
  onChange: (value: Search) => void;
  compact?: boolean;
  minDate?: string;
}) {
  const change = <K extends keyof Search>(key: K, val: Search[K]) =>
    onChange({ ...value, [key]: val });
  return (
    <div className={`search-fields ${compact ? "compact-fields" : ""}`}>
      <Field>
        <Label>Dato</Label>
        <Input
          aria-label="Dato"
          type="date"
          required
          min={minDate}
          value={value.date}
          onChange={(e) => change("date", e.target.value)}
        />
      </Field>
      <Field>
        <Label>Fra kl.</Label>
        <Input
          aria-label="Fra kl."
          type="time"
          required
          step={900}
          value={value.start}
          onChange={(e) => change("start", e.target.value)}
        />
      </Field>
      <Field>
        <Label>Til kl.</Label>
        <Input
          aria-label="Til kl."
          type="time"
          required
          step={900}
          value={value.end}
          onChange={(e) => change("end", e.target.value)}
        />
      </Field>
      <Field>
        <Label>Personer</Label>
        <Input
          aria-label="Personer"
          type="number"
          min={1}
          max={500}
          required
          value={value.people}
          onChange={(e) => change("people", Number(e.target.value))}
        />
      </Field>
    </div>
  );
}
export function validateSearch(search: Search): string | undefined {
  try {
    const span = interval(search);
    if (span.startTime < Date.now())
      return "Velg et tidspunkt som ikke har passert.";
    if (!Number.isInteger(search.people) || search.people < 1)
      return "Legg inn antall deltakere.";
  } catch (e) {
    return (e as Error).message;
  }
}
export { Button, Field, Input, Label, Select, ArrowRight };
