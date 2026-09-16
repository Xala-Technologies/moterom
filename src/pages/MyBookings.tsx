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
  Building2,
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
import type { Booking, Search } from "../../shared/types";
import {
  addDays,
  displayDate,
  money,
  searchParams,
  shortTime,
  toSearch,
  today,
} from "../../shared/time";
export function MyBookings() {
  const { user, loading } = useApp();
  const [tab, setTab] = useState("upcoming");
  const result = useApi<Booking[]>(user ? "/bookings" : null);
  if (loading) return <Loading />;
  if (!user) return <Navigate replace to="/login?returnTo=/mine-bookinger" />;
  const active = (b: Booking) =>
    b.endTime >= Date.now() && !["cancelled", "rejected"].includes(b.status);
  const bookings = (result.data || [])
    .filter((b) => (tab === "upcoming" ? active(b) : !active(b)))
    .sort((a, b) =>
      tab === "upcoming"
        ? a.startTime - b.startTime
        : b.startTime - a.startTime,
    );
  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DIN OVERSIKT</span>
          <h1>Mine bookinger</h1>
          <p>Her finner du tid, sted og opplysninger om møtene dine.</p>
        </div>
        <Link className="ds-button" to="/">
          Bestill et rom
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="pill-tabs" aria-label="Bookingfilter">
        <button
          aria-pressed={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
        >
          Kommende<span>{result.data?.filter(active).length || 0}</span>
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          Tidligere og avsluttede
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
                  {new Intl.DateTimeFormat("nb-NO", {
                    timeZone: "Europe/Oslo",
                    month: "short",
                  }).format(b.startTime)}
                </span>
                <strong>
                  {new Intl.DateTimeFormat("nb-NO", {
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
                <span>{b.people} personer</span>
              </div>
              <div className="booking-actions">
                <Link
                  className="ds-button"
                  data-variant="secondary"
                  data-size="sm"
                  to={`/booking/${b.id}`}
                >
                  Se booking
                  <ArrowRight size={16} />
                </Link>
                <span className="caption">
                  {money(b.totalPrice, b.currency)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<CalendarDays size={36} />}
          title={
            tab === "upcoming"
              ? "Du har ingen kommende bookinger"
              : "Ingen tidligere bookinger"
          }
        >
          <p>
            {tab === "upcoming"
              ? "Finn et rom til ditt neste møte. Vi tar vare på oversikten her."
              : "Avsluttede og kansellerte bookinger vil vises her."}
          </p>
          <Link className="ds-button" to="/">
            Finn et møterom
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
  const result = useApi<Booking>(user ? `/bookings/${id}` : null);
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
  if (!b) return null;
  const active =
    !["cancelled", "rejected", "completed"].includes(b.status) &&
    b.endTime > Date.now();
  const action = async () => {
    if (!modal) return;
    setBusy(true);
    setError(undefined);
    try {
      if (modal === "edit") {
        const problem = search && validateSearch(search);
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
          ? "Endringsforespørselen er sendt. Opprinnelig tid gjelder frem til godkjenning."
          : "Bookingen er kansellert.",
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
      <Link className="back-link" to="/mine-bookinger">
        <ArrowLeft size={17} />
        Mine bookinger
      </Link>
      {params.has("ny") && (
        <div className="confirmation-banner">
          <CheckCircle2 size={32} />
          <div>
            <h1>
              {b.status === "confirmed"
                ? "Bookingen er bekreftet"
                : "Forespørselen er sendt"}
            </h1>
            <p>
              {b.status === "confirmed"
                ? "Du finner alle opplysningene nedenfor."
                : "Du får beskjed når utleier har behandlet forespørselen."}
            </p>
          </div>
        </div>
      )}
      <div className="booking-detail-heading">
        <div>
          <Status status={b.status} />
          <h1>{b.roomName}</h1>
          <p className="muted">Referanse: {b.reference}</p>
        </div>
        <Building2 size={40} strokeWidth={1.2} />
      </div>
      <div className="booking-facts">
        <div>
          <CalendarDays />
          <span>Dato</span>
          <strong>{displayDate(b.startTime, true)}</strong>
        </div>
        <div>
          <Clock3 />
          <span>Tidspunkt</span>
          <strong>
            {shortTime(b.startTime)}–{shortTime(b.endTime)}
          </strong>
        </div>
        <div>
          <UsersRound />
          <span>Deltakere</span>
          <strong>{b.people} personer</strong>
        </div>
      </div>
      <div className="detail-action-bar">
        <a
          className="ds-button"
          data-variant="secondary"
          href={`/api/bookings/${b.id}/calendar.ics`}
        >
          <Download size={18} />
          Legg til i kalender
        </a>
        <Link
          className="ds-button"
          data-variant="secondary"
          to={`/rom/${b.roomId}?${searchParams(repeat)}`}
        >
          <RotateCcw size={18} />
          Book igjen
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
              Be om endring
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
                Avbestill
              </Button>
            )}
          </>
        )}
      </div>
      {b.editRequested && (
        <div className="info-message" role="status">
          Endringsforespørselen er sendt. Opprinnelig rom og tidspunkt gjelder
          frem til godkjenning.
        </div>
      )}
      <div className="booking-information">
        <section>
          <h2>Opplysninger</h2>
          <dl className="simple-dl">
            <div>
              <dt>Bestilt av</dt>
              <dd>{b.name || user.name}</dd>
            </div>
            <div>
              <dt>E-post</dt>
              <dd>{b.email || user.email}</dd>
            </div>
            <div>
              <dt>Totalpris</dt>
              <dd>{money(b.totalPrice, b.currency)}</dd>
            </div>
            {b.paymentRequired && (
              <div>
                <dt>Betaling</dt>
                <dd>Utestående betaling</dd>
              </div>
            )}
          </dl>
          {b.notes && <p className="preserve-lines">{b.notes}</p>}
        </section>
        <section>
          <h2>Før du kommer</h2>
          <p>
            {config?.address ||
              "Kontakt utleier dersom du trenger hjelp med adkomst."}
          </p>
          {config?.contactEmail && (
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
          )}
          <p className="muted">
            {b.cancellationMessage ||
              "Endringer og avbestilling behandles etter rommets regler. Kontakt utleier dersom du trenger hjelp."}
          </p>
        </section>
      </div>
      {modal && (
        <Modal
          title={
            modal === "cancel"
              ? "Avbestille bookingen?"
              : "Be om et nytt tidspunkt"
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          <p>
            {modal === "cancel"
              ? `${b.roomName} · ${displayDate(b.startTime)} · ${shortTime(b.startTime)}–${shortTime(b.endTime)}`
              : "Du beholder den opprinnelige bookingen til endringen er godkjent."}
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
              Tilbake
            </Button>
            <Button
              disabled={busy}
              data-color={modal === "cancel" ? "danger" : "accent"}
              onClick={action}
            >
              {busy
                ? "Sender …"
                : modal === "cancel"
                  ? "Ja, avbestill"
                  : "Send endringsforespørsel"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
