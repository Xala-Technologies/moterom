import { useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Textarea } from "@digdir/designsystemet-react";
import { useApp } from "../context";
import { api, post, useApi } from "../api";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Modal,
  SearchFields,
  Select,
  Status,
  validateSearch,
} from "../components/ui";
import type {
  AdminData,
  Block,
  Booking,
  Room,
  Search,
} from "../../shared/types";
import {
  addDays,
  defaultSearch,
  displayDate,
  interval,
  overlaps,
  shortTime,
  today,
  toSearch,
} from "../../shared/time";
type CalendarEvent = {
  id: string;
  roomId: string;
  startTime: number;
  endTime: number;
  title: string;
  status: string;
  kind: "booking" | "block";
  booking?: Booking;
  block?: Block;
};
export function Admin() {
  const { user, loading, config, notify } = useApp();
  const location = useLocation();
  const section = location.pathname.split("/")[2] || "today";
  const result = useApi<AdminData>(user?.isAdmin ? "/admin" : null);
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"day" | "week">("day");
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");
  const [event, setEvent] = useState<CalendarEvent>();
  const [editRoom, setEditRoom] = useState<Room>();
  const [blockForm, setBlockForm] = useState(false);
  const [blockRoom, setBlockRoom] = useState("");
  const [blockSearch, setBlockSearch] = useState<Search>(defaultSearch());
  const [blockTitle, setBlockTitle] = useState("");
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const busyLock = useRef(false);
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (!user.isAdmin)
    return (
      <Empty
        icon={<ShieldCheck size={32} />}
        title="Denne siden er for administratorer"
      >
        <p>Du kan se dine egne reservasjoner under Mine bookinger.</p>
        <Link className="ds-button" to="/mine-bookinger">
          Mine bookinger
        </Link>
      </Empty>
    );
  const bookings = result.data?.bookings || [];
  const rooms = result.data?.rooms || [];
  const blocks = result.data?.blocks || [];
  const activeBookings = bookings.filter(
    (b) => !["cancelled", "rejected"].includes(b.status),
  );
  const span = {
    startTime: interval({ date, start: "00:00", end: "23:59" }).startTime,
    endTime: interval({ date: addDays(date, 1), start: "00:00", end: "00:01" })
      .startTime,
  };
  const daily = activeBookings.filter((b) => overlaps(b, span));
  const events: CalendarEvent[] = [
    ...activeBookings.map((b) => ({
      ...b,
      title: b.title || b.name || "Booking",
      kind: "booking" as const,
      booking: b,
    })),
    ...blocks.map((b) => ({
      ...b,
      status: "blocked",
      kind: "block" as const,
      block: b,
    })),
  ];
  const filteredBookings = bookings
    .filter(
      (b) =>
        (status === "all" || b.status === status) &&
        `${b.roomName} ${b.name} ${b.email} ${b.reference}`
          .toLowerCase()
          .includes(term.toLowerCase()),
    )
    .sort((a, b) => b.startTime - a.startTime);
  const run = async (task: () => Promise<unknown>, message: string) => {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await task();
      notify(message);
      setEvent(undefined);
      setEditRoom(undefined);
      setBlockForm(false);
      result.reload();
    } catch (e) {
      setError(e as Error);
    } finally {
      busyLock.current = false;
      setBusy(false);
    }
  };
  const openEvent = (e: CalendarEvent) => {
    setError(undefined);
    setEvent(e);
  };
  const createBlock = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateSearch(blockSearch);
    if (problem) return setError(new Error(problem));
    void run(
      () =>
        post("/admin/blocks", {
          ...blockSearch,
          roomId: blockRoom || rooms[0]?.id,
          title: blockTitle,
        }),
      "Tidsrommet er blokkert.",
    );
  };
  const headings: Record<string, [string, string]> = {
    today: ["Oversikt", "Ha kontroll på rommene og dagens møter."],
    calendar: [
      "Romkalender",
      "Se bookinger og blokkerte perioder på tvers av rom.",
    ],
    bookings: ["Bookinger", "Følg opp reservasjoner og forespørsler."],
    rooms: ["Rom og innhold", "Oppdater opplysninger som kundene ser."],
    settings: ["Tilgang og innstillinger", "Byggets oppsett og bookingregler."],
  };
  const heading = headings[section] || headings.today;
  const calendar = (
    <>
      <div className="calendar-toolbar">
        <div className="date-controls">
          <Button
            variant="secondary"
            icon
            aria-label={view === "week" ? "Forrige uke" : "Forrige dag"}
            onClick={() => setDate(addDays(date, view === "week" ? -7 : -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button variant="secondary" onClick={() => setDate(today())}>
            I dag
          </Button>
          <Button
            variant="secondary"
            icon
            aria-label={view === "week" ? "Neste uke" : "Neste dag"}
            onClick={() => setDate(addDays(date, view === "week" ? 7 : 1))}
          >
            <ChevronRight size={18} />
          </Button>
          <Input
            aria-label="Kalenderdato"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </div>
        <div className="view-switch" role="group" aria-label="Kalendervisning">
          <button aria-pressed={view === "day"} onClick={() => setView("day")}>
            Dag
          </button>
          <button
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            7 dager
          </button>
        </div>
      </div>
      <RoomCalendar
        date={date}
        rooms={rooms}
        events={events}
        days={view === "week" ? 7 : 1}
        onSelect={openEvent}
      />
      <div className="calendar-legend">
        <span>
          <i className="legend-booking" />
          Bekreftet
        </span>
        <span>
          <i className="legend-pending" />
          Venter på godkjenning
        </span>
        <span>
          <i className="legend-blocked" />
          Blokkert
        </span>
      </div>
    </>
  );
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={21} />
          </span>
          <div>
            <strong>{config?.buildingName}</strong>
            <small>Administrasjon</small>
          </div>
        </div>
        <nav aria-label="Administrasjonsmeny">
          <NavLink end to="/admin">
            <LayoutDashboard size={19} />
            Oversikt
          </NavLink>
          <NavLink to="/admin/calendar">
            <CalendarDays size={19} />
            Kalender
          </NavLink>
          <NavLink to="/admin/bookings">
            <ClipboardList size={19} />
            Bookinger
            {bookings.some((b) => b.status === "pending") && (
              <span className="nav-count">
                {bookings.filter((b) => b.status === "pending").length}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/rooms">
            <Building2 size={19} />
            Rom
          </NavLink>
          <NavLink to="/admin/settings">
            <Settings size={19} />
            Innstillinger
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={18} />
          <span>Du administrerer dette bygget.</span>
        </div>
      </aside>
      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="breadcrumb">
              Administrasjon <span>/</span> {heading[0]}
            </p>
            <h1>{heading[0]}</h1>
            <p className="muted">{heading[1]}</p>
          </div>
          <div className="admin-heading-actions">
            <Button
              variant="secondary"
              data-size="sm"
              onClick={() => {
                setError(undefined);
                setBlockForm(true);
                setBlockSearch(defaultSearch());
              }}
            >
              <LockKeyhole size={17} />
              Blokker tid
            </Button>
            <Link className="ds-button" data-size="sm" to="/">
              <Plus size={18} />
              Ny booking
            </Link>
          </div>
        </div>
        {result.error ? (
          <ErrorState error={result.error} retry={result.reload} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <>
            {result.data?.truncated && (
              <ErrorState error="Oversikten nådde grensen på 1000 bookinger. Åpne Digilist for hele historikken." />
            )}
            {section === "today" && (
              <>
                <div className="admin-stats">
                  <Stat
                    icon={<CalendarDays size={20} />}
                    value={daily.length}
                    label={`Bookinger ${date === today() ? "i dag" : displayDate(date)}`}
                  />
                  <Stat
                    icon={<Building2 size={20} />}
                    value={
                      rooms.length -
                      new Set(
                        events
                          .filter(
                            (e) =>
                              e.startTime <= Date.now() &&
                              e.endTime > Date.now(),
                          )
                          .map((e) => e.roomId),
                      ).size
                    }
                    label="Rom uten aktivitet nå"
                  />
                  <Stat
                    icon={<Clock3 size={20} />}
                    value={
                      bookings.filter((b) => b.status === "pending").length
                    }
                    label="Venter på godkjenning"
                  />
                </div>
                <div className="section-heading">
                  <h2>Romkalender</h2>
                  <NavLink className="text-link" to="/admin/calendar">
                    Åpne kalender
                    <ArrowUpRight size={16} />
                  </NavLink>
                </div>
                {calendar}
              </>
            )}
            {section === "calendar" && calendar}
            {section === "bookings" && (
              <>
                <div className="admin-list-toolbar">
                  <Input
                    type="search"
                    aria-label="Søk i bookinger"
                    placeholder="Søk etter rom, kunde eller referanse"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <Select
                    aria-label="Filtrer status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <Select.Option value="all">Alle statuser</Select.Option>
                    <Select.Option value="confirmed">Bekreftet</Select.Option>
                    <Select.Option value="pending">
                      Venter på godkjenning
                    </Select.Option>
                    <Select.Option value="cancelled">Kansellert</Select.Option>
                    <Select.Option value="rejected">Avslått</Select.Option>
                  </Select>
                </div>
                <div className="admin-booking-list">
                  {filteredBookings.length ? (
                    filteredBookings.map((b) => (
                      <button
                        className="admin-booking-row"
                        key={b.id}
                        onClick={() =>
                          openEvent({
                            ...b,
                            title: b.title || b.name,
                            kind: "booking",
                            booking: b,
                          })
                        }
                      >
                        <div>
                          <strong>{b.roomName}</strong>
                          <span>{b.name || b.email}</span>
                          <small>{b.reference}</small>
                        </div>
                        <div>
                          <strong>{displayDate(b.startTime)}</strong>
                          <span>
                            {shortTime(b.startTime)}–{shortTime(b.endTime)}
                          </span>
                        </div>
                        <Status status={b.status} />
                        <span className="text-link">
                          Følg opp
                          <ArrowUpRight size={16} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <Empty title="Ingen bookinger å vise">
                      <p>Prøv et annet søk eller statusfilter.</p>
                    </Empty>
                  )}
                </div>
              </>
            )}
            {section === "rooms" && (
              <div className="admin-rooms">
                {rooms.map((room) => (
                  <article className="admin-room" key={room.id}>
                    <span className="room-icon">
                      <Building2 size={25} />
                    </span>
                    <div>
                      <h2>{room.name}</h2>
                      <p>
                        <UsersRound size={16} />
                        {room.capacityLabel}
                      </p>
                      <span className="caption">
                        {room.requiresApproval
                          ? "Krever godkjenning"
                          : "Direkte booking"}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      data-size="sm"
                      onClick={() => {
                        setEditRoom({ ...room });
                        setError(undefined);
                      }}
                    >
                      Rediger
                    </Button>
                  </article>
                ))}
              </div>
            )}
            {section === "settings" && (
              <div className="settings-sections">
                <section>
                  <h2>Bygget</h2>
                  <dl className="simple-dl">
                    <div>
                      <dt>Navn</dt>
                      <dd>{config?.buildingName}</dd>
                    </div>
                    <div>
                      <dt>Adresse</dt>
                      <dd>{config?.address || "Ikke lagt inn"}</dd>
                    </div>
                    <div>
                      <dt>Tidssone</dt>
                      <dd>Europe/Oslo</dd>
                    </div>
                    <div>
                      <dt>Tilgang</dt>
                      <dd>
                        {config?.access === "members"
                          ? "Kun byggets medlemmer"
                          : "Åpen romoversikt · innlogging ved booking"}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h2>Bookingregler og medarbeidere</h2>
                  <p>
                    Åpningstider, pauser mellom bookinger, priser og
                    medarbeidertilgang administreres i Digilist. Det samme
                    oppsettet gjelder her.
                  </p>
                  <a
                    href={config?.dashboardUrl}
                    className="ds-button"
                    data-variant="secondary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Åpne Digilist
                    <ArrowUpRight size={17} />
                    <span className="sr-only"> (åpnes i ny fane)</span>
                  </a>
                </section>
                {config?.mode === "demo" && (
                  <section>
                    <h2>Før kundelansering</h2>
                    <p>
                      Bekreft navnene på Eidefossen-rommene, kapasitet per
                      oppsett, rombilder og bookingregler. Demoen sender ikke
                      e-post og krever ingen betaling.
                    </p>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {event && (
        <Modal
          title={
            event.kind === "block" ? "Blokkert tidsrom" : "Bookingdetaljer"
          }
          close={() => {
            if (!busy) setEvent(undefined);
          }}
        >
          <p className="eyebrow">
            {rooms.find((r) => r.id === event.roomId)?.name}
          </p>
          <h3>{event.title}</h3>
          <p>
            {displayDate(event.startTime, true)}
            <br />
            {shortTime(event.startTime)}–{shortTime(event.endTime)}
          </p>
          {event.booking && (
            <>
              <Status status={event.status} />
              <p>
                {event.booking.name}
                <br />
                {event.booking.email}
              </p>
              <p className="caption">{event.booking.reference}</p>
              <p className="preserve-lines">{event.booking.notes}</p>
            </>
          )}
          {error && <ErrorState error={error} />}
          <div className="modal-actions">
            {event.kind === "block" ? (
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() =>
                  run(
                    () =>
                      api(`/admin/blocks/${event.id}`, { method: "DELETE" }),
                    "Blokkeringen er fjernet.",
                  )
                }
              >
                Fjern blokkering
              </Button>
            ) : (
              <>
                <Link
                  className="ds-button"
                  data-variant="secondary"
                  to={`/booking/${event.id}`}
                >
                  Åpne booking
                </Link>
                {event.status === "pending" && (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => post(`/bookings/${event.id}/approve`),
                          "Bookingen er godkjent.",
                        )
                      }
                    >
                      <Check size={16} />
                      Godkjenn
                    </Button>
                    <Button
                      disabled={busy}
                      variant="secondary"
                      data-color="danger"
                      onClick={() =>
                        run(
                          () => post(`/bookings/${event.id}/reject`),
                          "Forespørselen er avslått.",
                        )
                      }
                    >
                      <X size={16} />
                      Avslå
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
      {editRoom && (
        <Modal
          title={`Rediger ${editRoom.name}`}
          close={() => {
            if (!busy) setEditRoom(undefined);
          }}
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(`/admin/rooms/${editRoom.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      name: editRoom.name,
                      capacity: editRoom.capacity,
                      description: editRoom.description,
                      requiresApproval: editRoom.requiresApproval,
                    }),
                  }),
                "Rommet er oppdatert.",
              );
            }}
          >
            <Field>
              <Label>Romnavn</Label>
              <Input
                aria-label="Romnavn"
                value={editRoom.name}
                required
                maxLength={100}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, name: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>Bekreftet kapasitet</Label>
              <Input
                aria-label="Bekreftet kapasitet"
                type="number"
                min={1}
                max={500}
                value={editRoom.capacity}
                required
                onChange={(e) =>
                  setEditRoom({ ...editRoom, capacity: Number(e.target.value) })
                }
              />
            </Field>
            <Field>
              <Label>Beskrivelse</Label>
              <Textarea
                aria-label="Beskrivelse"
                value={editRoom.description}
                maxLength={3000}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, description: e.target.value })
                }
              />
            </Field>
            <label className="consent">
              <input
                type="checkbox"
                checked={editRoom.requiresApproval}
                onChange={(e) =>
                  setEditRoom({
                    ...editRoom,
                    requiresApproval: e.target.checked,
                  })
                }
              />
              Bookinger krever godkjenning
            </label>
            {error && <ErrorState error={error} />}
            <Button type="submit" disabled={busy}>
              {busy ? "Lagrer …" : "Lagre endringer"}
            </Button>
          </form>
        </Modal>
      )}
      {blockForm && (
        <Modal
          title="Blokker et tidsrom"
          close={() => {
            if (!busy) setBlockForm(false);
          }}
        >
          <p className="muted">
            Rommet blir utilgjengelig for nye bookinger i perioden.
          </p>
          <form className="stack" onSubmit={createBlock}>
            <Field>
              <Label>Rom</Label>
              <Select
                aria-label="Rom"
                value={blockRoom || rooms[0]?.id || ""}
                onChange={(e) => setBlockRoom(e.target.value)}
              >
                {rooms.map((r) => (
                  <Select.Option key={r.id} value={r.id}>
                    {r.name}
                  </Select.Option>
                ))}
              </Select>
            </Field>
            <SearchFields
              compact
              value={blockSearch}
              onChange={setBlockSearch}
            />
            <Field>
              <Label>Årsak</Label>
              <Input
                aria-label="Årsak"
                value={blockTitle}
                maxLength={120}
                required
                placeholder="For eksempel vedlikehold"
                onChange={(e) => setBlockTitle(e.target.value)}
              />
            </Field>
            {error && <ErrorState error={error} />}
            <Button type="submit" disabled={busy}>
              {busy ? "Blokkerer …" : "Blokker tidsrom"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="stat-icon">{icon}</span>
    </div>
  );
}
function RoomCalendar({
  date,
  rooms,
  events,
  days,
  onSelect,
}: {
  date: string;
  rooms: Room[];
  events: CalendarEvent[];
  days: number;
  onSelect: (event: CalendarEvent) => void;
}) {
  const dayEvents = (day: string) =>
    events.filter(
      (e) =>
        toSearch(e.startTime, e.endTime).date <= day &&
        toSearch(e.endTime - 1, e.endTime).date >= day,
    );
  const eventLabel = (e: CalendarEvent) => {
    const room = rooms.find((r) => r.id === e.roomId)?.name || "Rom";
    const kind = e.kind === "block" ? "blokkert" : e.status;
    return `${room}: ${e.title}, ${shortTime(e.startTime)}–${shortTime(e.endTime)}, ${kind}`;
  };
  if (days > 1)
    return (
      <div className="week-calendar">
        {Array.from({ length: days }, (_, i) => {
          const day = addDays(date, i);
          const items = dayEvents(day).sort(
            (a, b) => a.startTime - b.startTime,
          );
          return (
            <section className="week-day" key={day}>
              <h3>{displayDate(day)}</h3>
              {items.length ? (
                items.map((e) => (
                  <button
                    key={e.id}
                    className={`week-event event-${e.status}`}
                    aria-label={eventLabel(e)}
                    onClick={() => onSelect(e)}
                  >
                    <strong>
                      {rooms.find((r) => r.id === e.roomId)?.name}
                    </strong>
                    <span>
                      {shortTime(e.startTime)}–{shortTime(e.endTime)}
                    </span>
                    <small>{e.title}</small>
                  </button>
                ))
              ) : (
                <p className="caption">Ingen bookinger</p>
              )}
            </section>
          );
        })}
      </div>
    );
  const items = dayEvents(date);
  const minutes = (ms: number) => {
    const day = toSearch(ms, ms).date;
    if (day < date) return 0;
    if (day > date) return 1440;
    const t = shortTime(ms).split(":").map(Number);
    return t[0] * 60 + t[1];
  };
  const from = Math.min(
    8,
    ...items.map((e) => Math.floor(minutes(e.startTime) / 60)),
  );
  const until = Math.max(
    18,
    ...items.map((e) => Math.ceil(minutes(e.endTime) / 60)),
  );
  const hours = Array.from({ length: until - from + 1 }, (_, i) => from + i);
  const width = Math.max(680, hours.length * 62);
  return (
    <>
      <div className="timeline-scroll">
        <div className="timeline" style={{ minWidth: width + 180 }}>
          <div className="timeline-header">
            <span>Rom</span>
            <div>
              {hours.slice(0, -1).map((h) => (
                <span key={h}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>
          {rooms.map((room) => (
            <div className="timeline-row" key={room.id}>
              <div className="timeline-room">
                <strong>{room.name}</strong>
                <span>{room.capacityLabel}</span>
              </div>
              <div
                className="timeline-track"
                style={{ backgroundSize: `${100 / (until - from)}% 100%` }}
              >
                {items
                  .filter((e) => e.roomId === room.id)
                  .map((e) => {
                    const start =
                      toSearch(e.startTime, e.endTime).date < date
                        ? from * 60
                        : minutes(e.startTime);
                    const end =
                      toSearch(e.endTime - 1, e.endTime).date > date
                        ? until * 60
                        : minutes(e.endTime);
                    const left = Math.max(
                      0,
                      ((start - from * 60) / ((until - from) * 60)) * 100,
                    );
                    const width = Math.min(
                      100 - left,
                      ((end - Math.max(start, from * 60)) /
                        ((until - from) * 60)) *
                        100,
                    );
                    return (
                      <button
                        key={e.id}
                        className={`timeline-event event-${e.status}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1)}%`,
                        }}
                        aria-label={eventLabel(e)}
                        title={`${room.name}: ${e.title}, ${shortTime(e.startTime)}–${shortTime(e.endTime)}`}
                        onClick={() => onSelect(e)}
                      >
                        <strong>{e.title}</strong>
                        <span>
                          {shortTime(e.startTime)}–{shortTime(e.endTime)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mobile-agenda">
        {items.length ? (
          items
            .sort((a, b) => a.startTime - b.startTime)
            .map((e) => (
              <button
                key={e.id}
                aria-label={eventLabel(e)}
                onClick={() => onSelect(e)}
              >
                <span>
                  {shortTime(e.startTime)}
                  <small>{shortTime(e.endTime)}</small>
                </span>
                <div>
                  <strong>{rooms.find((r) => r.id === e.roomId)?.name}</strong>
                  <p>{e.title}</p>
                </div>
                {e.kind === "block" ? (
                  <LockKeyhole size={18} />
                ) : (
                  <Status status={e.status} />
                )}
              </button>
            ))
        ) : (
          <Empty icon={<CalendarDays />} title="Ingen bookinger denne dagen">
            <p>Velg en annen dato eller opprett en ny booking.</p>
          </Empty>
        )}
      </div>
    </>
  );
}
