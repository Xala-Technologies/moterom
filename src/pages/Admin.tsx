import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChartColumn,
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
import { RoomPhoto } from "../components/RoomPhoto";
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
  interval,
  overlaps,
  today,
  toSearch,
} from "../../shared/time";
import { AdminInsights } from "./AdminInsights";
import { roomCopy, useFormatters, useI18nLocale, useT } from "../i18n";
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
  const { t } = useT();
  const { locale } = useI18nLocale();
  const { displayDate, shortTime } = useFormatters();
  const location = useLocation();
  const [params] = useSearchParams();
  const section = location.pathname.split("/")[2] || "today";
  const result = useApi<AdminData>(user?.isAdmin ? "/admin" : null);
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"day" | "week">("day");
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");
  const [event, setEvent] = useState<CalendarEvent>();
  const [editRoom, setEditRoom] = useState<Room>();
  const [imageFile, setImageFile] = useState<{
    filename: string;
    contentType: "image/webp" | "image/jpeg" | "image/png";
    data: string;
  }>();
  const [imagePreview, setImagePreview] = useState<string>();
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
        title={t("admin.forbidden_title")}
      >
        <p>{t("admin.forbidden_body")}</p>
        <Link className="ds-button" to="/">
          {t("common.to_room_overview")}
        </Link>
      </Empty>
    );
  if (section === "today" && params.get("visning") === "innsikt") {
    const copy = new URLSearchParams(params);
    copy.delete("visning");
    const qs = copy.toString();
    return (
      <Navigate replace to={qs ? `/admin/innsikt?${qs}` : "/admin/innsikt"} />
    );
  }
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
      title: b.title || b.name || t("admin.event_fallback_title"),
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
      setImageFile(undefined);
      setImagePreview(undefined);
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
    const problem = validateSearch(blockSearch, t);
    if (problem) return setError(new Error(problem));
    void run(
      () =>
        post("/admin/blocks", {
          ...blockSearch,
          roomId: blockRoom || rooms[0]?.id,
          title: blockTitle,
        }),
      t("admin.toasts.blocked"),
    );
  };
  const headings: Record<string, [string, string]> = {
    today: [t("admin.headings.today.title"), t("admin.headings.today.body")],
    innsikt: [
      t("admin.headings.innsikt.title"),
      t("admin.headings.innsikt.body"),
    ],
    calendar: [
      t("admin.headings.calendar.title"),
      t("admin.headings.calendar.body"),
    ],
    bookings: [
      t("admin.headings.bookings.title"),
      t("admin.headings.bookings.body"),
    ],
    rooms: [t("admin.headings.rooms.title"), t("admin.headings.rooms.body")],
    settings: [
      t("admin.headings.settings.title"),
      t("admin.headings.settings.body"),
    ],
  };
  const heading = headings[section] || headings.today!;
  const calendar = (
    <>
      <div className="calendar-toolbar">
        <div className="date-controls">
          <Button
            variant="secondary"
            icon
            aria-label={
              view === "week" ? t("a11y.previous_week") : t("a11y.previous_day")
            }
            onClick={() => setDate(addDays(date, view === "week" ? -7 : -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button variant="secondary" onClick={() => setDate(today())}>
            {t("admin.today")}
          </Button>
          <Button
            variant="secondary"
            icon
            aria-label={
              view === "week" ? t("a11y.next_week") : t("a11y.next_day")
            }
            onClick={() => setDate(addDays(date, view === "week" ? 7 : 1))}
          >
            <ChevronRight size={18} />
          </Button>
          <Input
            aria-label={t("a11y.calendar_date")}
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </div>
        <div
          className="view-switch"
          role="group"
          aria-label={t("a11y.calendar_view")}
        >
          <button aria-pressed={view === "day"} onClick={() => setView("day")}>
            {t("admin.day")}
          </button>
          <button
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            {t("admin.seven_days")}
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
          {t("admin.legend_confirmed")}
        </span>
        <span>
          <i className="legend-pending" />
          {t("admin.legend_pending")}
        </span>
        <span>
          <i className="legend-blocked" />
          {t("admin.legend_blocked")}
        </span>
      </div>
    </>
  );
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav aria-label={t("a11y.admin_nav")}>
          <NavLink end to="/admin">
            <LayoutDashboard size={19} />
            {t("admin.nav.overview")}
          </NavLink>
          <NavLink to="/admin/innsikt">
            <ChartColumn size={19} />
            {t("admin.nav.insights")}
          </NavLink>
          <NavLink to="/admin/calendar">
            <CalendarDays size={19} />
            {t("admin.nav.calendar")}
          </NavLink>
          <NavLink to="/admin/bookings">
            <ClipboardList size={19} />
            {t("admin.nav.bookings")}
            {bookings.some((b) => b.status === "pending") && (
              <span className="nav-count">
                {bookings.filter((b) => b.status === "pending").length}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/rooms">
            <Building2 size={19} />
            {t("admin.nav.rooms")}
          </NavLink>
          <NavLink to="/admin/settings">
            <Settings size={19} />
            {t("admin.nav.settings")}
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={18} />
          <span>{t("admin.sidebar_footer")}</span>
        </div>
      </aside>
      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <h1>{heading[0]}</h1>
            <p className="muted">{heading[1]}</p>
          </div>
          {(section === "bookings" || section === "today") && (
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
                {t("admin.block_time")}
              </Button>
              <Link className="ds-button" data-size="sm" to="/ny-booking">
                <Plus size={18} />
                {t("admin.new_booking")}
              </Link>
            </div>
          )}
        </div>
        {result.error ? (
          <ErrorState error={result.error} retry={result.reload} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <>
            {result.data?.truncated && section !== "innsikt" && (
              <ErrorState error={t("admin.truncated_warning")} />
            )}
            {section === "innsikt" && <AdminInsights rooms={rooms} />}
            {section === "today" && (
              <>
                <div className="admin-stats">
                  <Stat
                    icon={<CalendarDays size={20} />}
                    value={daily.length}
                    label={
                      date === today()
                        ? t("admin.stats.bookings_today")
                        : t("admin.stats.bookings_on_date", {
                            date: displayDate(date),
                          })
                    }
                  />
                  <Stat
                    icon={<Building2 size={20} />}
                    value={
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
                    label={t("admin.stats.happening_now")}
                  />
                  <Stat
                    icon={<Clock3 size={20} />}
                    value={
                      bookings.filter((b) => b.status === "pending").length
                    }
                    label={t("admin.stats.pending_approval")}
                  />
                </div>
                {bookings.some((b) => b.status === "pending") && (
                  <>
                    <div className="section-heading">
                      <h2>{t("admin.pending_section")}</h2>
                    </div>
                    <div className="admin-booking-list">
                      {bookings
                        .filter((b) => b.status === "pending")
                        .sort((a, b) => a.startTime - b.startTime)
                        .map((b) => (
                          <article
                            className="admin-booking-row pending-row"
                            key={b.id}
                          >
                            <button
                              type="button"
                              className="pending-main"
                              onClick={() =>
                                openEvent({
                                  ...b,
                                  title:
                                    b.title ||
                                    b.name ||
                                    t("admin.event_fallback_title"),
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
                                  {shortTime(b.startTime)}–
                                  {shortTime(b.endTime)}
                                </span>
                              </div>
                            </button>
                            <div className="pending-actions">
                              <Button
                                disabled={busy}
                                data-size="sm"
                                onClick={() =>
                                  run(
                                    () => post(`/bookings/${b.id}/approve`),
                                    t("admin.toasts.approved"),
                                  )
                                }
                              >
                                <Check size={16} />
                                {t("admin.approve")}
                              </Button>
                              <Button
                                disabled={busy}
                                variant="secondary"
                                data-color="danger"
                                data-size="sm"
                                onClick={() =>
                                  run(
                                    () => post(`/bookings/${b.id}/reject`),
                                    t("admin.toasts.rejected"),
                                  )
                                }
                              >
                                <X size={16} />
                                {t("admin.reject")}
                              </Button>
                            </div>
                          </article>
                        ))}
                    </div>
                  </>
                )}
                <div className="section-heading">
                  <h2>{t("admin.todays_programme")}</h2>
                </div>
                {events.filter((e) => overlaps(e, span)).length ? (
                  <div className="admin-booking-list">
                    {events
                      .filter((e) => overlaps(e, span))
                      .sort((a, b) => a.startTime - b.startTime)
                      .map((e) => (
                        <button
                          className="admin-booking-row"
                          key={`${e.kind}-${e.id}`}
                          onClick={() => openEvent(e)}
                        >
                          <div>
                            <strong>
                              {rooms.find((r) => r.id === e.roomId)?.name}
                            </strong>
                            <span>{e.title}</span>
                          </div>
                          <div>
                            <span>
                              {shortTime(e.startTime)}–{shortTime(e.endTime)}
                            </span>
                          </div>
                          {e.kind === "block" ? (
                            <span className="caption">
                              {t("common.status.blocked")}
                            </span>
                          ) : (
                            <Status status={e.status} />
                          )}
                        </button>
                      ))}
                  </div>
                ) : (
                  <Empty title={t("admin.empty_day_title")}>
                    <p>{t("admin.empty_day_body")}</p>
                  </Empty>
                )}
                <div className="section-heading">
                  <h2>{t("admin.room_calendar")}</h2>
                  <NavLink className="text-link" to="/admin/calendar">
                    {t("admin.open_calendar")}
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
                    aria-label={t("a11y.search_bookings")}
                    placeholder={t("admin.search_placeholder")}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <Select
                    aria-label={t("a11y.filter_status")}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <Select.Option value="all">
                      {t("admin.all_statuses")}
                    </Select.Option>
                    <Select.Option value="confirmed">
                      {t("common.status.confirmed")}
                    </Select.Option>
                    <Select.Option value="pending">
                      {t("common.status.pending")}
                    </Select.Option>
                    <Select.Option value="cancelled">
                      {t("common.status.cancelled")}
                    </Select.Option>
                    <Select.Option value="rejected">
                      {t("common.status.rejected")}
                    </Select.Option>
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
                            title:
                              b.title ||
                              b.name ||
                              t("admin.event_fallback_title"),
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
                          {t("admin.follow_up")}
                          <ArrowUpRight size={16} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <Empty title={t("admin.empty_bookings_title")}>
                      <p>{t("admin.empty_bookings_body")}</p>
                    </Empty>
                  )}
                </div>
              </>
            )}
            {section === "rooms" && (
              <div className="admin-rooms">
                {rooms.map((room) => {
                  const copy = roomCopy(room, locale);
                  return (
                    <article className="admin-room" key={room.id}>
                      <span className="room-icon">
                        <Building2 size={25} />
                      </span>
                      <div>
                        <h2>{room.name}</h2>
                        <p>
                          <UsersRound size={16} />
                          {copy.capacityLabel}
                        </p>
                        <span className="caption">
                          {room.requiresApproval
                            ? t("admin.requires_approval")
                            : t("admin.direct_booking")}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        data-size="sm"
                        onClick={() => {
                          setImageFile(undefined);
                          setImagePreview(undefined);
                          setEditRoom({ ...room });
                          setError(undefined);
                        }}
                      >
                        {t("admin.edit")}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
            {section === "settings" && (
              <div className="settings-grid">
                <section className="settings-card">
                  <header className="settings-card-header">
                    <h2>{t("admin.settings_building")}</h2>
                    <p>{t("admin.settings_building_caption")}</p>
                  </header>
                  <div className="settings-card-body">
                    <dl className="settings-props">
                      <div>
                        <dt>{t("admin.settings_name")}</dt>
                        <dd>{config?.buildingName}</dd>
                      </div>
                      <div>
                        <dt>{t("admin.settings_address")}</dt>
                        <dd>{config?.address || t("admin.address_missing")}</dd>
                      </div>
                      <div>
                        <dt>{t("admin.settings_timezone")}</dt>
                        <dd>{t("admin.timezone_value")}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
                <section className="settings-card">
                  <header className="settings-card-header">
                    <h2>{t("admin.settings_access")}</h2>
                    <p>{t("admin.settings_access_caption")}</p>
                  </header>
                  <div className="settings-card-body">
                    <div className="settings-access">
                      <span className="settings-access-pill">
                        {config?.access === "members"
                          ? t("admin.access_members")
                          : t("admin.access_public_short")}
                      </span>
                      <p className="caption">
                        {config?.access === "members"
                          ? t("admin.access_members_hint")
                          : t("admin.access_public")}
                      </p>
                    </div>
                  </div>
                </section>
                <section className="settings-card">
                  <header className="settings-card-header">
                    <h2>{t("admin.settings_rules")}</h2>
                    <p>{t("admin.settings_rules_caption")}</p>
                  </header>
                  <div className="settings-card-body settings-card-action">
                    <p>{t("admin.settings_rules_body")}</p>
                    <a
                      href={config?.dashboardUrl}
                      className="ds-button settings-digilist-btn"
                      data-variant="secondary"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("common.open_digilist")}
                      <ArrowUpRight size={17} />
                      <span className="sr-only">
                        {" "}
                        {t("common.opens_new_tab")}
                      </span>
                    </a>
                  </div>
                </section>
                {config?.mode === "demo" && (
                  <aside
                    className="settings-callout"
                    aria-labelledby="settings-prelaunch-title"
                  >
                    <h2 id="settings-prelaunch-title">
                      {t("admin.prelaunch_title")}
                    </h2>
                    <p>{t("admin.prelaunch_body")}</p>
                  </aside>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {event && (
        <Modal
          title={
            event.kind === "block"
              ? t("admin.modal_block_details")
              : t("admin.modal_booking_details")
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
                {event.booking.phone ? (
                  <>
                    <br />
                    {event.booking.phone}
                  </>
                ) : null}
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
                    t("admin.toasts.block_removed"),
                  )
                }
              >
                {t("admin.remove_block")}
              </Button>
            ) : (
              <>
                <Link
                  className="ds-button"
                  data-variant="secondary"
                  to={`/booking/${event.id}`}
                >
                  {t("admin.open_booking")}
                </Link>
                {event.status === "pending" && (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => post(`/bookings/${event.id}/approve`),
                          t("admin.toasts.approved"),
                        )
                      }
                    >
                      <Check size={16} />
                      {t("admin.approve")}
                    </Button>
                    <Button
                      disabled={busy}
                      variant="secondary"
                      data-color="danger"
                      onClick={() =>
                        run(
                          () => post(`/bookings/${event.id}/reject`),
                          t("admin.toasts.rejected"),
                        )
                      }
                    >
                      <X size={16} />
                      {t("admin.reject")}
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
          title={t("admin.edit_room_title", { name: editRoom.name })}
          wide
          close={() => {
            if (!busy) {
              setEditRoom(undefined);
              setImageFile(undefined);
              setImagePreview(undefined);
            }
          }}
        >
          <form
            className="stack room-edit-form"
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
                      descriptionEn: editRoom.descriptionEn,
                      capacityLabel: editRoom.capacityLabel,
                      capacityLabelEn: editRoom.capacityLabelEn,
                      requiresApproval: editRoom.requiresApproval,
                      imageKind: editRoom.imageKind || "illustrative",
                      amenities: editRoom.amenities,
                      arrivalInfo: editRoom.arrivalInfo || "",
                      ...(imageFile ? { imageFile } : {}),
                    }),
                  }),
                t("admin.toasts.room_updated"),
              );
            }}
          >
            <div className="room-edit-photo">
              <span className="eyebrow">{t("admin.room_image")}</span>
              <RoomPhoto
                room={{
                  ...editRoom,
                  image: imagePreview || editRoom.image,
                }}
              />
            </div>
            <Field>
              <Label>{t("admin.room_image_upload")}</Label>
              <Input
                aria-label={t("admin.room_image_upload")}
                type="file"
                accept="image/webp,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const type = file.type as
                    "image/webp" | "image/jpeg" | "image/png";
                  if (!["image/webp", "image/jpeg", "image/png"].includes(type))
                    return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = String(reader.result || "");
                    const data = result.includes(",")
                      ? result.slice(result.indexOf(",") + 1)
                      : result;
                    const preview = URL.createObjectURL(file);
                    setImagePreview(preview);
                    setImageFile({
                      filename: file.name,
                      contentType: type,
                      data,
                    });
                    setEditRoom({
                      ...editRoom,
                      imageKind: editRoom.imageKind || "illustrative",
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <p className="caption">{t("admin.room_image_upload_hint")}</p>
            </Field>
            <Field>
              <Label>{t("admin.room_image_kind")}</Label>
              <Select
                aria-label={t("admin.room_image_kind")}
                value={editRoom.imageKind || "illustrative"}
                onChange={(e) =>
                  setEditRoom({
                    ...editRoom,
                    imageKind: e.target.value as "illustrative" | "actual",
                  })
                }
              >
                <Select.Option value="illustrative">
                  {t("admin.room_image_illustrative")}
                </Select.Option>
                <Select.Option value="actual">
                  {t("admin.room_image_actual")}
                </Select.Option>
              </Select>
            </Field>
            <Field>
              <Label>{t("admin.room_name")}</Label>
              <Input
                aria-label={t("admin.room_name")}
                value={editRoom.name}
                required
                maxLength={100}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, name: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.confirmed_capacity")}</Label>
              <Input
                aria-label={t("admin.confirmed_capacity")}
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
              <Label>{t("admin.capacity_label")}</Label>
              <Input
                aria-label={t("admin.capacity_label")}
                value={editRoom.capacityLabel}
                maxLength={100}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, capacityLabel: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.capacity_label_en")}</Label>
              <Input
                aria-label={t("admin.capacity_label_en")}
                value={editRoom.capacityLabelEn}
                maxLength={100}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, capacityLabelEn: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.description")}</Label>
              <Textarea
                aria-label={t("admin.description")}
                value={editRoom.description}
                maxLength={3000}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, description: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.description_en")}</Label>
              <Textarea
                aria-label={t("admin.description_en")}
                value={editRoom.descriptionEn}
                maxLength={3000}
                onChange={(e) =>
                  setEditRoom({ ...editRoom, descriptionEn: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.room_amenities")}</Label>
              <Textarea
                aria-label={t("admin.room_amenities")}
                value={editRoom.amenities.join("\n")}
                maxLength={1600}
                onChange={(e) =>
                  setEditRoom({
                    ...editRoom,
                    amenities: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  })
                }
              />
              <p className="caption">{t("admin.room_amenities_hint")}</p>
            </Field>
            <Field>
              <Label>{t("admin.room_arrival_info")}</Label>
              <Textarea
                aria-label={t("admin.room_arrival_info")}
                value={editRoom.arrivalInfo || ""}
                maxLength={1000}
                onChange={(e) =>
                  setEditRoom({
                    ...editRoom,
                    arrivalInfo: e.target.value || undefined,
                  })
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
              {t("admin.bookings_need_approval")}
            </label>
            {error && <ErrorState error={error} />}
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("admin.save_changes")}
            </Button>
          </form>
        </Modal>
      )}
      {blockForm && (
        <Modal
          title={t("admin.block_modal_title")}
          close={() => {
            if (!busy) setBlockForm(false);
          }}
        >
          <p className="muted">{t("admin.block_modal_intro")}</p>
          <form className="stack" onSubmit={createBlock}>
            <Field>
              <Label>{t("common.room")}</Label>
              <Select
                aria-label={t("common.room")}
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
              <Label>{t("admin.reason")}</Label>
              <Input
                aria-label={t("admin.reason")}
                value={blockTitle}
                maxLength={120}
                required
                placeholder={t("admin.reason_placeholder")}
                onChange={(e) => setBlockTitle(e.target.value)}
              />
            </Field>
            {error && <ErrorState error={error} />}
            <Button type="submit" disabled={busy}>
              {busy ? t("admin.blocking") : t("admin.block_submit")}
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
  icon: ReactNode;
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
  const { t } = useT();
  const { locale } = useI18nLocale();
  const { displayDate, shortTime } = useFormatters();
  const dayEvents = (day: string) =>
    events.filter(
      (e) =>
        toSearch(e.startTime, e.endTime).date <= day &&
        toSearch(e.endTime - 1, e.endTime).date >= day,
    );
  const eventLabel = (e: CalendarEvent) => {
    const room = rooms.find((r) => r.id === e.roomId)?.name || t("common.room");
    const kind =
      e.kind === "block"
        ? t("admin.blocked_kind")
        : t(`common.status.${e.status}`, { defaultValue: e.status });
    return t("admin.event_aria", {
      room,
      title: e.title,
      start: shortTime(e.startTime),
      end: shortTime(e.endTime),
      kind,
    });
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
                <p className="caption">{t("admin.no_bookings")}</p>
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
    const parts = shortTime(ms).split(":").map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
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
            <span>{t("admin.timeline_rooms")}</span>
            <div>
              {hours.slice(0, -1).map((h) => (
                <span key={h}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>
          {rooms.map((room) => {
            const copy = roomCopy(room, locale);
            return (
              <div className="timeline-row" key={room.id}>
                <div className="timeline-room">
                  <strong>{room.name}</strong>
                  <span>{copy.capacityLabel}</span>
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
                      const eventWidth = Math.min(
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
                            width: `${Math.max(eventWidth, 1)}%`,
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
            );
          })}
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
          <Empty icon={<CalendarDays />} title={t("admin.empty_agenda_title")}>
            <p>{t("admin.empty_agenda_body")}</p>
          </Empty>
        )}
      </div>
    </>
  );
}
