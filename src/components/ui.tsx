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
import { i18n, useT } from "../i18n";
export function Loading({ label }: { label?: string }) {
  const { t } = useT();
  const text = label ?? t("common.loading");
  return (
    <div className="state" role="status">
      <Spinner aria-label={text} data-size="md" />
      <span>{text}</span>
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
  const { t } = useT();
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div>
        <p>{typeof error === "string" ? error : error.message}</p>
        {retry && (
          <Button variant="secondary" data-size="sm" onClick={retry}>
            {t("common.retry")}
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
  const { t } = useT();
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
        <Button
          variant="tertiary"
          icon
          aria-label={t("common.close")}
          onClick={close}
        >
          <X size={22} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export function Status({ status }: { status: string }) {
  const { t } = useT();
  const labels: Record<string, string> = {
    confirmed: t("common.status.confirmed"),
    pending: t("common.status.pending"),
    cancelled: t("common.status.cancelled"),
    rejected: t("common.status.rejected"),
    completed: t("common.status.completed"),
    reserved: t("common.status.reserved"),
    blocked: t("common.status.blocked"),
    approved: t("common.status.approved"),
  };
  const tone = ["confirmed", "completed", "approved"].includes(status)
    ? "success"
    : status === "pending"
      ? "warning"
      : status === "blocked"
        ? "blocked"
        : "neutral";
  return (
    <span className={`status status-${tone}`}>
      {status === "confirmed" || status === "approved" ? (
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
  hideDate = false,
  minDate = today(),
}: {
  value: Search;
  onChange: (value: Search) => void;
  compact?: boolean;
  hideDate?: boolean;
  minDate?: string;
}) {
  const { t } = useT();
  const change = <K extends keyof Search>(key: K, val: Search[K]) =>
    onChange({ ...value, [key]: val, people: 1 });
  return (
    <div
      className={`search-fields ${compact ? "compact-fields" : ""}${hideDate ? " hide-date" : ""}`}
    >
      {!hideDate && (
        <Field>
          <Label>{t("common.date")}</Label>
          <Input
            aria-label={t("common.date")}
            type="date"
            required
            min={minDate}
            value={value.date}
            onChange={(e) => change("date", e.target.value)}
          />
        </Field>
      )}
      <Field>
        <Label>{t("common.time_from")}</Label>
        <Input
          aria-label={t("common.time_from")}
          type="time"
          required
          step={900}
          value={value.start}
          onChange={(e) => change("start", e.target.value)}
        />
      </Field>
      <Field>
        <Label>{t("common.time_to")}</Label>
        <Input
          aria-label={t("common.time_to")}
          type="time"
          required
          step={900}
          value={value.end}
          onChange={(e) => change("end", e.target.value)}
        />
      </Field>
    </div>
  );
}
export function validateSearch(
  search: Search,
  translate: (key: string) => string = (key) => i18n.t(key),
): string | undefined {
  try {
    const span = interval(search);
    if (span.startTime < Date.now()) return translate("validation.time_past");
  } catch (e) {
    return (e as Error).message;
  }
}
export { Button, Field, Input, Label, Select, ArrowRight };
