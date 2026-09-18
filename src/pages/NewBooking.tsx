import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { Textarea } from "@digdir/designsystemet-react";
import { useApp } from "../context";
import { api, post, useApi, ApiError } from "../api";
import {
  Button,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  validateSearch,
} from "../components/ui";
import { MonthCalendar } from "../components/MonthCalendar";
import type { Booking, Quote, Room, TimeSlot } from "../../shared/types";
import { readSearch } from "./Rooms";
import { useFormatters, useT } from "../i18n";
type Step = 1 | 2 | 3;
function parseStep(value: string | null): Step {
  if (value === "2" || value === "3") return Number(value) as Step;
  return 1;
}
function emailError(value: string, t: (key: string) => string) {
  const email = value.trim();
  if (!email) return t("validation.email_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return t("validation.email_invalid");
  return;
}
function phoneError(value: string, t: (key: string) => string) {
  const phone = value.trim();
  if (!phone) return;
  if (phone.replace(/\D/g, "").length < 8) return t("validation.phone_invalid");
  return;
}
export function NewBooking() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user, loading, config, refresh } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
  const dateChosen = params.has("date");
  const timeChosen = params.has("start") && params.has("end");
  const search = useMemo(() => readSearch(params), [params]);
  const roomId = params.get("rom") || "";
  const requested = parseStep(params.get("steg"));
  const searchError =
    dateChosen && timeChosen ? validateSearch(search, t) : undefined;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [revision, setRevision] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [nameIssue, setNameIssue] = useState<string>();
  const [emailIssue, setEmailIssue] = useState<string>();
  const [phoneIssue, setPhoneIssue] = useState<string>();
  const contactReady = Boolean(
    name.trim() && !emailError(email, t) && !phoneError(phone, t),
  );
  const step: Step =
    requested >= 2 && (!dateChosen || !timeChosen || searchError || !roomId)
      ? 1
      : requested === 3 && !contactReady
        ? 2
        : requested;
  const rooms = useApi<Room[]>("/rooms");
  const room = rooms.data?.find((r) => r.id === roomId);
  const slots = useApi<TimeSlot[]>(
    dateChosen && roomId && (!rooms.data || room)
      ? `/availability/slots?date=${search.date}&roomId=${encodeURIComponent(roomId)}`
      : null,
  );
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const request = useRef<{ key: string; body: unknown } | undefined>(undefined);
  const submitting = useRef(false);
  const prefilled = useRef(false);
  const steps = [
    { n: 1 as const, label: t("booking.steps.datetime") },
    { n: 2 as const, label: t("booking.steps.contact") },
    { n: 3 as const, label: t("booking.steps.confirm") },
  ];
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    setName(user.name);
    setEmail(user.email);
  }, [user]);
  const patch = (values: Record<string, string | null>, replace = true) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace });
  };
  const go = (nextStep: Step) => patch({ steg: String(nextStep) }, false);
  useEffect(() => {
    request.current = undefined;
  }, [roomId, search, user?.id]);
  useEffect(() => {
    if (step !== 3 || !roomId || !dateChosen || searchError) return;
    if (config?.mode === "live" && !user) return;
    const controller = new AbortController();
    setQuote(undefined);
    setError(undefined);
    api<Quote>("/quote", {
      method: "POST",
      body: JSON.stringify({ ...search, roomId }),
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
    step,
    roomId,
    user?.id,
    revision,
    config?.mode,
    dateChosen,
    search,
    searchError,
  ]);
  if (loading) return <Loading />;
  if (step === 3 && config?.mode === "live" && !user) {
    const returnTo = `/ny-booking?${params}`;
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
      />
    );
  }
  const selectedSlot = slots.data?.find(
    (slot) =>
      slot.start === params.get("start") && slot.end === params.get("end"),
  );
  const liveEmail = config?.mode === "live" && Boolean(user);
  const stepValid =
    step === 1
      ? Boolean(
          dateChosen && roomId && room && selectedSlot?.state === "available",
        )
      : step === 2
        ? contactReady
        : Boolean(quote && accepted && contactReady);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextName = name.trim() ? undefined : t("validation.name_required");
    const nextEmail = emailError(email, t);
    const nextPhone = phoneError(phone, t);
    setNameIssue(nextName);
    setEmailIssue(nextEmail);
    setPhoneIssue(nextPhone);
    if (
      nextName ||
      nextEmail ||
      nextPhone ||
      !quote ||
      !accepted ||
      submitting.current
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    request.current ??= {
      key: crypto.randomUUID(),
      body: {
        ...search,
        roomId,
        title,
        notes,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        quoteToken: quote.token,
      },
    };
    try {
      const booking = await post<Booking>("/bookings", request.current.body, {
        "Idempotency-Key": request.current.key,
      });
      await refresh();
      nav(`/booking/${booking.id}?ny=1`, { replace: true });
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
  const confirmLabel = quote?.requiresApproval
    ? t("booking.submit_request")
    : quote?.paymentMode === "invoice"
      ? t("booking.submit_invoice")
      : t("booking.submit_confirm");
  const pickRoom = (id: string) =>
    patch({
      rom: id,
      start: null,
      end: null,
      people: "1",
    });
  return (
    <div className="container booking-wizard">
      <div className="page-heading">
        <div>
          <h1>{t("booking.heading")}</h1>
          <p>
            {room
              ? t("booking.book_room", { name: room.name })
              : t("booking.find_room_intro")}
          </p>
        </div>
      </div>
      <ol className="wizard-stepper">
        {steps.map((item) => {
          const current = step === item.n;
          const done = step > item.n;
          return (
            <li key={item.n} aria-current={current ? "step" : undefined}>
              {done ? (
                <button type="button" onClick={() => go(item.n)}>
                  <span className="wizard-step-index" aria-hidden="true">
                    <Check size={14} />
                  </span>
                  {item.label}
                </button>
              ) : (
                <span>
                  <span className="wizard-step-index" aria-hidden="true">
                    {item.n}
                  </span>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {step === 1 && (
        <div className="wizard-datetime">
          <MonthCalendar
            value={dateChosen ? search.date : ""}
            onChange={(date) =>
              patch({
                date,
                start: null,
                end: null,
                people: "1",
                steg: "1",
              })
            }
          />
          <div className="wizard-time-panel">
            {!dateChosen ? (
              <p className="muted">{t("booking.pick_date_for_time")}</p>
            ) : !roomId || (rooms.data && !room) ? (
              <>
                <h2>{t("booking.pick_room")}</h2>
                <p className="muted">
                  {t("booking.pick_room_help", {
                    date: displayDate(search.date, true),
                  })}
                </p>
                {roomId && rooms.data && !room && (
                  <ErrorState error={t("booking.room_missing")} />
                )}
                {rooms.loading ? (
                  <Loading label={t("booking.loading_rooms")} />
                ) : rooms.error ? (
                  <ErrorState error={rooms.error} retry={rooms.reload} />
                ) : (
                  <div
                    className="wizard-room-pick"
                    role="group"
                    aria-label={t("a11y.pick_room")}
                  >
                    {(rooms.data || []).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={item.id === roomId}
                        onClick={() => pickRoom(item.id)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>{t("booking.available_slots")}</h2>
                <p className="muted">
                  {t("booking.slots_help", {
                    room: room?.name ?? "",
                    date: displayDate(search.date, true),
                  })}
                </p>
                <button
                  type="button"
                  className="wizard-change-room"
                  onClick={() =>
                    patch({ rom: null, start: null, end: null, people: "1" })
                  }
                >
                  {t("booking.change_room")}
                </button>
                {slots.loading ? (
                  <Loading label={t("booking.checking_slots")} />
                ) : slots.error ? (
                  <ErrorState error={slots.error} retry={slots.reload} />
                ) : (
                  <>
                    <div
                      className="wizard-slots"
                      role="group"
                      aria-label={t("a11y.available_times")}
                    >
                      {(slots.data || []).map((slot) => {
                        const selected =
                          timeChosen &&
                          slot.start === search.start &&
                          slot.end === search.end;
                        const label = `${slot.start}–${slot.end}`;
                        return (
                          <button
                            type="button"
                            key={slot.start}
                            className={
                              slot.state === "available"
                                ? selected
                                  ? "is-selected"
                                  : "is-available"
                                : "is-unavailable"
                            }
                            aria-pressed={selected}
                            aria-label={
                              slot.state === "available"
                                ? label
                                : slot.state === "error"
                                  ? t("a11y.slot_unknown", { label })
                                  : t("a11y.slot_unavailable", { label })
                            }
                            disabled={slot.state !== "available"}
                            onClick={() =>
                              patch({
                                start: slot.start,
                                end: slot.end,
                                people: "1",
                              })
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {slots.data?.every(
                      (slot) => slot.state !== "available",
                    ) && (
                      <p className="muted" role="status">
                        {t("booking.no_slots")}
                      </p>
                    )}
                  </>
                )}
                {searchError && <ErrorState error={searchError} />}
              </>
            )}
          </div>
        </div>
      )}
      {step === 2 && (
        <section className="surface-section stack wizard-contact">
          <h2>{t("booking.who_books")}</h2>
          <p className="muted">{t("booking.contact_intro")}</p>
          <Field>
            <Label htmlFor="booking-name">{t("common.name")}</Label>
            <Input
              id="booking-name"
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              aria-invalid={Boolean(nameIssue)}
              aria-describedby={nameIssue ? "booking-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameIssue(undefined);
                request.current = undefined;
              }}
            />
            {nameIssue && (
              <p id="booking-name-error" className="field-error" role="alert">
                {nameIssue}
              </p>
            )}
          </Field>
          <Field>
            <Label htmlFor="booking-email">{t("common.email")}</Label>
            <Input
              id="booking-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              readOnly={liveEmail}
              disabled={liveEmail}
              value={email}
              aria-invalid={Boolean(emailIssue)}
              aria-describedby={
                emailIssue
                  ? "booking-email-error"
                  : liveEmail
                    ? "booking-email-hint"
                    : undefined
              }
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailIssue(undefined);
                request.current = undefined;
              }}
            />
            {liveEmail && (
              <p id="booking-email-hint" className="caption">
                {t("booking.email_locked_hint")}
              </p>
            )}
            {emailIssue && (
              <p id="booking-email-error" className="field-error" role="alert">
                {emailIssue}
              </p>
            )}
          </Field>
          <Field>
            <Label htmlFor="booking-phone">
              {t("common.phone")}{" "}
              <span className="optional">{t("common.optional")}</span>
            </Label>
            <Input
              id="booking-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={32}
              value={phone}
              aria-invalid={Boolean(phoneIssue)}
              aria-describedby={
                phoneIssue ? "booking-phone-error" : "booking-phone-hint"
              }
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneIssue(undefined);
                request.current = undefined;
              }}
            />
            <p id="booking-phone-hint" className="caption">
              {t("booking.phone_hint")}
            </p>
            {phoneIssue && (
              <p id="booking-phone-error" className="field-error" role="alert">
                {phoneIssue}
              </p>
            )}
          </Field>
        </section>
      )}
      {step === 3 && (
        <div className="checkout-layout">
          <form id="wizard-confirm" onSubmit={submit} className="checkout-form">
            <section className="surface-section stack">
              <h2>{t("booking.about_meeting")}</h2>
              <Field>
                <Label htmlFor="booking-title">
                  {t("booking.meeting_title")}{" "}
                  <span className="optional">{t("common.optional")}</span>
                </Label>
                <Input
                  id="booking-title"
                  aria-label={t("booking.meeting_title")}
                  value={title}
                  maxLength={120}
                  disabled={busy || Boolean(request.current)}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    request.current = undefined;
                  }}
                  placeholder={t("booking.meeting_title_placeholder")}
                />
              </Field>
              <Field>
                <Label htmlFor="booking-notes">
                  {t("booking.message_to_host")}{" "}
                  <span className="optional">{t("common.optional")}</span>
                </Label>
                <Textarea
                  id="booking-notes"
                  aria-label={t("booking.message_to_host")}
                  value={notes}
                  maxLength={1000}
                  disabled={busy || Boolean(request.current)}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    request.current = undefined;
                  }}
                  rows={3}
                />
              </Field>
            </section>
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
            {quote && (
              <div className="review-action">
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    required
                  />
                  <span>{t("booking.consent_checked")}</span>
                </label>
              </div>
            )}
          </form>
          <aside className="order-summary">
            <span className="eyebrow">{t("booking.your_booking")}</span>
            <h2>{room?.name || t("common.meeting_room")}</h2>
            <dl>
              <div>
                <dt>
                  <CalendarDays size={18} />
                  {t("common.date")}
                </dt>
                <dd>{displayDate(search.date, true)}</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={18} />
                  {t("common.time")}
                </dt>
                <dd>
                  {search.start}–{search.end}
                </dd>
              </div>
              <div>
                <dt>
                  <UserRound size={18} />
                  {t("common.name")}
                </dt>
                <dd>{name.trim()}</dd>
              </div>
              <div>
                <dt>
                  <Mail size={18} />
                  {t("common.email")}
                </dt>
                <dd>{email.trim()}</dd>
              </div>
              {phone.trim() ? (
                <div>
                  <dt>
                    <Phone size={18} />
                    {t("common.phone")}
                  </dt>
                  <dd>{phone.trim()}</dd>
                </div>
              ) : null}
            </dl>
            <p className="caption">{t("booking.rules_caption")}</p>
          </aside>
        </div>
      )}
      <div className="wizard-actions">
        {step === 1 ? (
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (location.key === "default") nav("/");
              else nav(-1);
            }}
          >
            <ArrowLeft size={17} />
            {t("common.back")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            type="button"
            onClick={() => go((step - 1) as Step)}
          >
            <ArrowLeft size={17} />
            {t("common.back")}
          </Button>
        )}
        {step < 3 ? (
          <Button
            type="button"
            disabled={!stepValid || (step === 1 && slots.loading)}
            onClick={() => go((step + 1) as Step)}
          >
            {t("common.next")}
            <ArrowRight size={17} />
          </Button>
        ) : (
          <Button
            type="submit"
            form="wizard-confirm"
            disabled={busy || !stepValid}
          >
            {busy ? t("booking.submitting") : confirmLabel}
          </Button>
        )}
      </div>
      {step === 3 && quote && (
        <p className="caption align-center wizard-confirm-note">
          <Mail size={15} />
          {quote.requiresApproval
            ? t("booking.approval_followup")
            : t("booking.confirm_next_page")}
        </p>
      )}
    </div>
  );
}
