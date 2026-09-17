import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  RotateCcw,
  UsersRound,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { post, useApi } from "../api";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  SearchFields,
  Status,
  validateSearch,
} from "../components/ui";
import { bookHref } from "../components/RoomCard";
import { RoomPhoto } from "../components/RoomPhoto";
import type { Booking, Room, Search } from "../../shared/types";
import { addDays, searchParams, toSearch, today } from "../../shared/time";
import { useFormatters, useT } from "../i18n";

function roomFallback(booking: Booking): Room {
  return {
    id: booking.roomId,
    name: booking.roomName,
    slug: booking.roomId,
    capacity: 0,
    capacityLabel: "",
    capacityLabelEn: "",
    description: "",
    descriptionEn: "",
    amenities: [],
    requiresApproval: false,
  };
}

function isActiveBooking(b: Booking) {
  return (
    b.endTime >= Date.now() && !["cancelled", "rejected"].includes(b.status)
  );
}

/** Digilist-style personal bookings dashboard (minside pattern) for this building. */
export function MyBookings() {
  const { user, loading } = useApp();
  const { t } = useT();
  const { displayDate, shortTime, money } = useFormatters();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const result = useApi<Booking[]>(user ? "/bookings" : null);
  if (loading) return <Loading />;
  if (!user) return <Navigate replace to="/login?returnTo=/mine-bookinger" />;
  const all = result.data || [];
  const upcomingCount = all.filter(isActiveBooking).length;
  const pendingCount = all.filter((b) => b.status === "pending").length;
  const confirmedCount = all.filter(
    (b) =>
      ["confirmed", "approved", "reserved"].includes(b.status) &&
      isActiveBooking(b),
  ).length;
  const bookings = all
    .filter((b) =>
      tab === "upcoming" ? isActiveBooking(b) : !isActiveBooking(b),
    )
    .sort((a, b) =>
      tab === "upcoming"
        ? a.startTime - b.startTime
        : b.startTime - a.startTime,
    );
  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("dashboard.eyebrow")}</span>
          <h1>{t("dashboard.heading")}</h1>
          <p>{t("dashboard.intro")}</p>
        </div>
        <div className="page-heading-actions">
          <Link className="ds-button" to="/">
            {t("dashboard.book_room")}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <div className="admin-stats dashboard-stats" aria-live="polite">
        <div className="stat">
          <div>
            <span>{t("dashboard.stat_pending")}</span>
            <strong>{pendingCount}</strong>
          </div>
          <span className="stat-icon" aria-hidden="true">
            <Clock3 size={18} />
          </span>
        </div>
        <div className="stat">
          <div>
            <span>{t("dashboard.stat_confirmed")}</span>
            <strong>{confirmedCount}</strong>
          </div>
          <span className="stat-icon" aria-hidden="true">
            <CheckCircle2 size={18} />
          </span>
        </div>
        <div className="stat">
          <div>
            <span>{t("dashboard.stat_total")}</span>
            <strong>{all.length}</strong>
          </div>
          <span className="stat-icon" aria-hidden="true">
            <CalendarDays size={18} />
          </span>
        </div>
      </div>
      <div className="pill-tabs" aria-label={t("dashboard.filter_aria")}>
        <button
          type="button"
          aria-pressed={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
        >
          {t("dashboard.tab_upcoming")}
          <span>{upcomingCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          {t("dashboard.tab_history")}
        </button>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : bookings.length ? (
        <div className="booking-list">
          {bookings.map((b, i) => (
            <article
              className={`booking-row ${i === 0 && tab === "upcoming" ? "next-booking" : ""}`}
              key={b.id}
            >
              <div className="booking-date">
                <span>
                  {new Intl.DateTimeFormat(undefined, {
                    timeZone: "Europe/Oslo",
                    month: "short",
                  }).format(b.startTime)}
                </span>
                <strong>
                  {new Intl.DateTimeFormat(undefined, {
                    timeZone: "Europe/Oslo",
                    day: "numeric",
                  }).format(b.startTime)}
                </strong>
              </div>
              <div className="booking-main">
                <Status status={b.status} />
                <h2>
                  <Link to={`/booking/${b.id}`}>{b.roomName}</Link>
                </h2>
                <p>{b.title || b.reference}</p>
              </div>
              <div className="booking-time">
                <strong>{displayDate(b.startTime)}</strong>
                <span>
                  {shortTime(b.startTime)}–{shortTime(b.endTime)}
                </span>
                {typeof b.people === "number" && b.people > 0 ? (
                  <span>
                    {t("booking.participants")}: {b.people}
                  </span>
                ) : null}
              </div>
              <div className="booking-actions">
                <Link
                  className="ds-button"
                  data-variant="secondary"
                  data-size="sm"
                  to={`/booking/${b.id}`}
                >
                  {t("dashboard.view_booking")}
                  <ArrowRight size={16} />
                </Link>
                {typeof b.totalPrice === "number" ? (
                  <span className="caption">
                    {money(b.totalPrice, b.currency)}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<CalendarDays size={36} />}
          title={
            tab === "upcoming"
              ? t("dashboard.empty_upcoming_title")
              : t("dashboard.empty_history_title")
          }
        >
          <p>
            {tab === "upcoming"
              ? t("dashboard.empty_upcoming_body")
              : t("dashboard.empty_history_body")}
          </p>
          <Link className="ds-button" to="/">
            {t("common.find_rooms")}
          </Link>
        </Empty>
      )}
    </div>
  );
}

export function BookingDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, loading, config, notify } = useApp();
  const { t } = useT();
  const { displayDate, shortTime, money } = useFormatters();
  const result = useApi<Booking>(user ? `/bookings/${id}` : null);
  const rooms = useApi<Room[]>(user ? "/rooms" : null);
  const [modal, setModal] = useState<"cancel" | "edit" | null>(null);
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<Search>();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (result.loading) return <Loading />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  const b = result.data;
  if (!b)
    return (
      <Empty title={t("booking.not_found_title")}>
        <p>{t("booking.not_found_body")}</p>
        <Link className="ds-button" to="/">
          {t("common.to_room_overview")}
        </Link>
      </Empty>
    );
  const active =
    !["cancelled", "rejected", "completed"].includes(b.status) &&
    b.endTime > Date.now();
  const room =
    rooms.data?.find((entry) => entry.id === b.roomId) ?? roomFallback(b);
  const showPeople = typeof b.people === "number" && b.people > 0;
  const action = async () => {
    if (!modal) return;
    setBusy(true);
    setError(undefined);
    try {
      if (modal === "edit") {
        const problem = search && validateSearch(search, t);
        if (problem) throw new Error(problem);
      }
      const updated = await post<Booking>(
        `/bookings/${id}/${modal}`,
        modal === "edit" ? search : {},
      );
      result.setData(updated);
      setModal(null);
      notify(
        modal === "edit"
          ? t("booking.notify_edit_sent")
          : t("booking.notify_cancelled"),
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const repeat = {
    ...toSearch(b.startTime, b.endTime, b.people),
    date: addDays(today(), 1),
  };
  return (
    <div className="container booking-detail-container">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} />
        {t("common.find_rooms")}
      </Link>
      {params.has("ny") && (
        <div className="confirmation-banner" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <div>
            <p className="confirmation-banner-title">
              {b.status === "confirmed"
                ? t("booking.confirmed_banner")
                : t("booking.request_sent_banner")}
            </p>
            <p>
              {b.status === "confirmed"
                ? t("booking.confirmed_body")
                : t("booking.request_sent_body")}
            </p>
          </div>
        </div>
      )}
      <div className="booking-detail-summary">
        <div className="booking-detail-photo">
          <RoomPhoto room={room} />
        </div>
        <div className="booking-detail-heading">
          <Status status={b.status} />
          <h1>{b.roomName}</h1>
          <p className="muted">
            {t("booking.reference", { reference: b.reference })}
          </p>
        </div>
      </div>
      <div
        className={`booking-facts${showPeople ? " booking-facts-three" : ""}`}
      >
        <div>
          <CalendarDays aria-hidden="true" />
          <span>{t("common.date")}</span>
          <strong>{displayDate(b.startTime, true)}</strong>
        </div>
        <div>
          <Clock3 aria-hidden="true" />
          <span>{t("booking.time_label")}</span>
          <strong>
            {shortTime(b.startTime)}–{shortTime(b.endTime)}
          </strong>
        </div>
        {showPeople ? (
          <div>
            <UsersRound aria-hidden="true" />
            <span>{t("booking.participants")}</span>
            <strong>{b.people}</strong>
          </div>
        ) : null}
      </div>
      <div className="detail-action-bar">
        <a
          className="ds-button"
          data-variant="secondary"
          href={`/api/bookings/${b.id}/calendar.ics`}
        >
          <Download size={18} />
          {t("booking.add_to_calendar")}
        </a>
        <Link
          className="ds-button"
          data-variant="secondary"
          to={bookHref(b.roomId, searchParams(repeat))}
        >
          <RotateCcw size={18} />
          {t("booking.book_again")}
        </Link>
        {active && (
          <>
            <Button
              variant="tertiary"
              onClick={() => {
                setSearch(toSearch(b.startTime, b.endTime, b.people));
                setError(undefined);
                setModal("edit");
              }}
            >
              <Edit3 size={17} />
              {t("booking.request_change")}
            </Button>
            {b.cancellationAllowed !== false && (
              <Button
                variant="tertiary"
                data-color="danger"
                onClick={() => {
                  setError(undefined);
                  setModal("cancel");
                }}
              >
                <X size={17} />
                {t("booking.cancel")}
              </Button>
            )}
          </>
        )}
      </div>
      {b.editRequested && (
        <div className="info-message" role="status">
          {t("booking.edit_pending_info")}
        </div>
      )}
      <div className="booking-information">
        <section className="booking-info-panel">
          <h2>{t("booking.details")}</h2>
          <dl className="simple-dl">
            <div>
              <dt>{t("booking.booked_by")}</dt>
              <dd>{b.name || user.name}</dd>
            </div>
            <div>
              <dt>{t("common.email")}</dt>
              <dd>{b.email || user.email}</dd>
            </div>
            {b.phone ? (
              <div>
                <dt>{t("common.phone")}</dt>
                <dd>{b.phone}</dd>
              </div>
            ) : null}
            {typeof b.totalPrice === "number" && b.totalPrice > 0 ? (
              <div>
                <dt>{t("booking.total_price")}</dt>
                <dd>{money(b.totalPrice, b.currency)}</dd>
              </div>
            ) : null}
            {b.paymentRequired && (
              <div>
                <dt>{t("booking.payment")}</dt>
                <dd>{t("booking.payment_outstanding")}</dd>
              </div>
            )}
            {b.confirmationUrl && (
              <div>
                <dt>Digilist</dt>
                <dd>
                  <a href={b.confirmationUrl} rel="noreferrer">
                    {t("booking.open_confirmation_digilist")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {b.notes && <p className="preserve-lines">{b.notes}</p>}
        </section>
        <section className="booking-info-panel">
          <h2>{t("booking.before_you_arrive")}</h2>
          <p>{config?.address || t("booking.access_fallback")}</p>
          {config?.contactEmail && (
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
          )}
          <p className="muted">
            {b.cancellationMessage || t("booking.cancel_rules_fallback")}
          </p>
        </section>
      </div>
      {modal && (
        <Modal
          title={
            modal === "cancel"
              ? t("booking.cancel_modal_title")
              : t("booking.edit_modal_title")
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          <p>
            {modal === "cancel"
              ? `${b.roomName} · ${displayDate(b.startTime)} · ${shortTime(b.startTime)}–${shortTime(b.endTime)}`
              : t("booking.edit_modal_body")}
          </p>
          {modal === "edit" && search && (
            <SearchFields compact value={search} onChange={setSearch} />
          )}{" "}
          {error && <ErrorState error={error} />}
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              {t("common.back")}
            </Button>
            <Button
              disabled={busy}
              data-color={modal === "cancel" ? "danger" : "accent"}
              onClick={action}
            >
              {busy
                ? t("common.sending")
                : modal === "cancel"
                  ? t("booking.confirm_cancel")
                  : t("booking.send_edit_request")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
