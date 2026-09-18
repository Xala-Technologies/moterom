import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, post, ApiError } from "../api";
import { useApp } from "../context";
import type { Booking, Quote, Room } from "../../shared/types";
import { useFormatters, useT } from "../i18n";
import {
  Button,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Modal,
  Status,
} from "./ui";
import type { RoomSlotSelection } from "./RoomCardSchedule";

function emailError(value: string, t: (key: string) => string) {
  const email = value.trim();
  if (!email) return t("validation.email_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return t("validation.email_invalid");
  return;
}

export function BookingConfirmModal({
  room,
  selection,
  purpose,
  onPurposeChange,
  close,
  onSuccess,
}: {
  room: Room;
  selection: RoomSlotSelection;
  purpose: string;
  onPurposeChange: (value: string) => void;
  close: () => void;
  onSuccess: () => void;
}) {
  const { user, config, refresh } = useApp();
  const { t } = useT();
  const { displayDate, money } = useFormatters();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking>();
  const [nameIssue, setNameIssue] = useState<string>();
  const [emailIssue, setEmailIssue] = useState<string>();
  const [revision, setRevision] = useState(0);
  const request = useRef<{ key: string; body: unknown } | undefined>(undefined);
  const submitting = useRef(false);
  const search = {
    date: selection.date,
    start: selection.start,
    end: selection.end,
    people: 1,
  };
  const liveUnauthed = config?.mode === "live" && !user;
  const needsContact = !user;
  const returnTo = `/ny-booking?${new URLSearchParams({
    rom: room.id,
    date: selection.date,
    start: selection.start,
    end: selection.end,
    people: "1",
    steg: "3",
  })}`;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    request.current = undefined;
  }, [room.id, selection.date, selection.start, selection.end, user?.id]);

  useEffect(() => {
    if (liveUnauthed || booking) return;
    const controller = new AbortController();
    setQuote(undefined);
    setError(undefined);
    api<Quote>("/quote", {
      method: "POST",
      body: JSON.stringify({ ...search, roomId: room.id }),
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setQuote(value);
        if (request.current)
          request.current.body = {
            ...(request.current.body as Record<string, unknown>),
            quoteToken: value.token,
          };
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [
    liveUnauthed,
    booking,
    room.id,
    selection.date,
    selection.start,
    selection.end,
    user?.id,
    revision,
  ]);

  const confirmLabel = quote?.requiresApproval
    ? t("booking.submit_request")
    : quote?.paymentMode === "invoice"
      ? t("booking.submit_invoice")
      : t("booking.submit_confirm");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (liveUnauthed || !quote || submitting.current) return;
    const nextName = needsContact
      ? name.trim()
        ? undefined
        : t("validation.name_required")
      : undefined;
    const nextEmail = needsContact ? emailError(email, t) : undefined;
    setNameIssue(nextName);
    setEmailIssue(nextEmail);
    if (nextName || nextEmail) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    request.current ??= {
      key: crypto.randomUUID(),
      body: {
        ...search,
        roomId: room.id,
        title: purpose,
        notes: "",
        name: (user?.name || name).trim(),
        email: (user?.email || email).trim(),
        phone: "",
        quoteToken: quote.token,
      },
    };
    try {
      const created = await post<Booking>("/bookings", request.current.body, {
        "Idempotency-Key": request.current.key,
      });
      await refresh();
      setBooking(created);
      onSuccess();
    } catch (err) {
      setError(err as Error);
      if (err instanceof ApiError && err.code === "quote_expired") {
        setQuote(undefined);
        setRevision((n) => n + 1);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const priceLine = !quote
    ? null
    : quote.priceOnRequest || quote.total == null
      ? t("common.money.price_on_request")
      : money(quote.total, quote.currency);

  return (
    <Modal title={t("rooms.confirm_booking_title")} close={close}>
      {booking ? (
        <div className="booking-confirm-success">
          <Status status={booking.status} />
          <p>
            {booking.status === "pending"
              ? t("booking.request_sent_body")
              : ["confirmed", "approved"].includes(booking.status)
                ? t("booking.confirmed_body")
                : t("booking.existing_booking_body")}
          </p>
          <p className="caption">
            {t("booking.reference", { reference: booking.reference })}
          </p>
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Link className="ds-button" to={`/booking/${booking.id}?ny=1`}>
              {t("rooms.view_booking")}
            </Link>
          </div>
        </div>
      ) : liveUnauthed ? (
        <div className="stack">
          <dl className="booking-confirm-summary">
            <div>
              <dt>{t("common.room")}</dt>
              <dd>{room.name}</dd>
            </div>
            <div>
              <dt>{t("common.date")}</dt>
              <dd>{displayDate(selection.date, true)}</dd>
            </div>
            <div>
              <dt>{t("common.time")}</dt>
              <dd>
                {selection.start}–{selection.end}
              </dd>
            </div>
          </dl>
          <p>{t("booking.login_required_body")}</p>
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Link
              className="ds-button"
              to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              {t("auth.log_in")}
            </Link>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <dl className="booking-confirm-summary">
            <div>
              <dt>{t("common.room")}</dt>
              <dd>{room.name}</dd>
            </div>
            <div>
              <dt>{t("common.date")}</dt>
              <dd>{displayDate(selection.date, true)}</dd>
            </div>
            <div>
              <dt>{t("common.time")}</dt>
              <dd>
                {selection.start}–{selection.end}
              </dd>
            </div>
            {priceLine && (
              <div>
                <dt>{t("booking.total_price")}</dt>
                <dd>{priceLine}</dd>
              </div>
            )}
          </dl>
          <Field>
            <Label htmlFor="card-booking-purpose">
              {t("rooms.purpose_label")}{" "}
              <span className="optional">{t("common.optional")}</span>
            </Label>
            <Input
              id="card-booking-purpose"
              value={purpose}
              maxLength={120}
              disabled={busy || Boolean(request.current)}
              onChange={(e) => {
                onPurposeChange(e.target.value);
                request.current = undefined;
              }}
              placeholder={t("rooms.purpose_placeholder")}
            />
          </Field>
          {needsContact && (
            <>
              <Field>
                <Label htmlFor="card-booking-name">{t("common.name")}</Label>
                <Input
                  id="card-booking-name"
                  name="name"
                  autoComplete="name"
                  required
                  disabled={busy || Boolean(request.current)}
                  maxLength={100}
                  value={name}
                  aria-invalid={Boolean(nameIssue)}
                  aria-describedby={
                    nameIssue ? "card-booking-name-error" : undefined
                  }
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameIssue(undefined);
                    request.current = undefined;
                  }}
                />
                {nameIssue && (
                  <p
                    id="card-booking-name-error"
                    className="field-error"
                    role="alert"
                  >
                    {nameIssue}
                  </p>
                )}
              </Field>
              <Field>
                <Label htmlFor="card-booking-email">{t("common.email")}</Label>
                <Input
                  id="card-booking-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy || Boolean(request.current)}
                  maxLength={254}
                  value={email}
                  aria-invalid={Boolean(emailIssue)}
                  aria-describedby={
                    emailIssue ? "card-booking-email-error" : undefined
                  }
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailIssue(undefined);
                    request.current = undefined;
                  }}
                />
                {emailIssue && (
                  <p
                    id="card-booking-email-error"
                    className="field-error"
                    role="alert"
                  >
                    {emailIssue}
                  </p>
                )}
              </Field>
            </>
          )}
          {error && (
            <>
              <ErrorState
                error={error}
                retry={!quote ? () => setRevision((n) => n + 1) : undefined}
              />
              {request.current && <p>{t("booking.retry_same_order")}</p>}
            </>
          )}
          {!quote && !error && (
            <Loading label={t("booking.checking_availability")} />
          )}
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Button type="submit" disabled={busy || !quote}>
              {busy ? t("booking.submitting") : confirmLabel}
            </Button>
          </div>
          {quote && (
            <p className="caption">
              {quote.requiresApproval
                ? t("booking.approval_followup")
                : t("rooms.confirm_keeps_you_here")}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
