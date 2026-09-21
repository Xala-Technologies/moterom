import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  Ban,
  Building2,
  CalendarDays,
  ChartColumn,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  ClipboardList,
  Clock3,
  DoorOpen,
  Download,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search as SearchIcon,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { api, post, useApi } from "../api";
import { RoomPhoto } from "../components/RoomPhoto";
import { AdminBookingList } from "../components/admin/AdminBookingList";
import {
  bookingStatusParam,
  bookingsOverlappingDay,
  calendarHref,
  isActiveBooking,
  eventsOnDay,
  happeningNowRoomIds,
  matchesBookingQuery,
  matchesBookingStatus,
  matchesRoomFilter,
  newBookingHref,
  OVERVIEW_PENDING_LIMIT,
  parseOsloDate,
  pendingBookings,
  programmeWindow,
} from "../components/admin/adminOverview";
import { FilterSelect } from "../components/admin/FilterSelect";
import { BlockTimeForm } from "../components/admin/BlockTimeForm";
import { RoomEditForm } from "../components/admin/RoomEditForm";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Modal,
  Status,
  validateSearch,
} from "../components/ui";
import type {
  AccessRequest,
  AdminData,
  Block,
  Booking,
  Room,
  Search,
} from "../../shared/types";
import { compareAgenda } from "../../shared/bookingOrder";
import { addDays, defaultSearch, today, toSearch } from "../../shared/time";
import { AdminInsights } from "./AdminInsights";
import { AdminAccessRequests } from "../components/admin/AdminAccessRequests";
import { AdminMembers } from "../components/admin/AdminMembers";
import { AdminMessages } from "../components/admin/AdminMessages";
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
  const [params, setParams] = useSearchParams();
  const section = location.pathname.split("/")[2] || "today";
  const result = useApi<AdminData>(user?.isAdmin ? "/admin" : null);
  const accessResult = useApi<AccessRequest[]>(
    user?.isAdmin ? "/admin/access-requests" : null,
  );
  const todayDate = today();
  const date = parseOsloDate(params.get("dato")) ?? todayDate;
  const [view, setView] = useState<"day" | "week">("day");
  const dateControlsRef = useRef<HTMLDivElement>(null);
  const dateControlsViewportTop = useRef<number | null>(null);
  const patchParams = (next: Record<string, string | null>) => {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") copy.delete(key);
      else copy.set(key, value);
    }
    setParams(copy, { replace: true });
  };
  const changeDate = (next: string) => {
    if (!parseOsloDate(next) || next === date) return;
    dateControlsViewportTop.current =
      dateControlsRef.current?.getBoundingClientRect().top ?? null;
    patchParams({ dato: next === todayDate ? null : next });
  };
  useLayoutEffect(() => {
    const top = dateControlsViewportTop.current;
    const el = dateControlsRef.current;
    dateControlsViewportTop.current = null;
    if (top == null || !el) return;
    const delta = el.getBoundingClientRect().top - top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [date]);
  const statusFilter = bookingStatusParam(params.get("status"));
  const term = params.get("q") ?? "";
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
  if (!user.isAdmin) return <Navigate replace to="/" />;
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
  const roomParam = params.get("rom");
  const roomFilter =
    !roomParam || roomParam === "all"
      ? "all"
      : rooms.length > 0 && !rooms.some((room) => room.id === roomParam)
        ? "all"
        : roomParam;
  const activeBookings = bookings.filter((b) => isActiveBooking(b.status));
  const daily = bookingsOverlappingDay(activeBookings, date);
  const pending = pendingBookings(bookings);
  const pendingPreview = pending.slice(0, OVERVIEW_PENDING_LIMIT);
  const pendingAccess = (accessResult.data || []).filter(
    (request) => request.status === "pending",
  ).length;
  const now = Date.now();
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
  const happeningNow = happeningNowRoomIds(events, now).length;
  const programme = programmeWindow(eventsOnDay(events, date), {
    viewingToday: date === todayDate,
    now,
  });
  const filteredBookings = bookings
    .filter(
      (b) =>
        matchesBookingStatus(b.status, statusFilter) &&
        matchesRoomFilter(b.roomId, roomFilter) &&
        matchesBookingQuery(b, term),
    )
    .sort(compareAgenda);
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
    users: [t("admin.headings.users.title"), t("admin.headings.users.body")],
    messages: [
      t("admin.headings.messages.title"),
      t("admin.headings.messages.body"),
    ],
    settings: [
      t("admin.headings.settings.title"),
      t("admin.headings.settings.body"),
    ],
  };
  const heading = headings[section] || headings.today!;
  const calendarView =
    section === "calendar" && view === "week" ? "week" : "day";
  const openCalendar = calendarHref(date, todayDate);
  const calendar = (
    <>
      <div className="calendar-toolbar">
        <div className="date-controls" ref={dateControlsRef}>
          <Button
            variant="secondary"
            icon
            aria-label={
              calendarView === "week"
                ? t("a11y.previous_week")
                : t("a11y.previous_day")
            }
            onClick={() =>
              changeDate(addDays(date, calendarView === "week" ? -7 : -1))
            }
          >
            <ChevronLeft size={18} />
          </Button>
          <Button variant="secondary" onClick={() => changeDate(todayDate)}>
            {t("admin.today")}
          </Button>
          <Button
            variant="secondary"
            icon
            aria-label={
              calendarView === "week" ? t("a11y.next_week") : t("a11y.next_day")
            }
            onClick={() =>
              changeDate(addDays(date, calendarView === "week" ? 7 : 1))
            }
          >
            <ChevronRight size={18} />
          </Button>
          <Input
            aria-label={t("a11y.calendar_date")}
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) changeDate(e.target.value);
            }}
          />
        </div>
        {section === "calendar" && (
          <div
            className="view-switch"
            role="group"
            aria-label={t("a11y.calendar_view")}
          >
            <button
              aria-pressed={calendarView === "day"}
              onClick={() => setView("day")}
            >
              {t("admin.day")}
            </button>
            <button
              aria-pressed={calendarView === "week"}
              onClick={() => setView("week")}
            >
              {t("admin.seven_days")}
            </button>
          </div>
        )}
      </div>
      <RoomCalendar
        date={date}
        rooms={rooms}
        events={events}
        days={calendarView === "week" ? 7 : 1}
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
          <NavLink to="/admin/messages">
            <MessageCircle size={19} />
            {t("admin.nav.messages")}
          </NavLink>
          <NavLink to="/admin/rooms">
            <Building2 size={19} />
            {t("admin.nav.rooms")}
          </NavLink>
          <NavLink to="/admin/users">
            <UsersRound size={19} />
            {t("admin.nav.users")}
            {(accessResult.data || []).some((r) => r.status === "pending") && (
              <span className="nav-count">
                {
                  (accessResult.data || []).filter(
                    (r) => r.status === "pending",
                  ).length
                }
              </span>
            )}
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
          {(section === "bookings" ||
            section === "today" ||
            section === "calendar") && (
            <div className="admin-heading-actions">
              <Button
                variant="secondary"
                data-size="sm"
                onClick={() => {
                  setError(undefined);
                  setBlockForm(true);
                  setBlockSearch({
                    date: date >= todayDate ? date : todayDate,
                    start: "09:00",
                    end: "10:00",
                    people: 1,
                  });
                }}
              >
                <LockKeyhole size={17} />
                {t("admin.block_time")}
              </Button>
              <Link
                className="ds-button"
                data-size="sm"
                to={newBookingHref(date)}
              >
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
                    to={openCalendar}
                    icon={<CalendarDays size={20} />}
                    value={daily.length}
                    label={
                      date === todayDate
                        ? t("admin.stats.bookings_today")
                        : t("admin.stats.bookings_on_date", {
                            date: displayDate(date),
                          })
                    }
                    hint={t("admin.stats.open_calendar")}
                  />
                  <Stat
                    to={calendarHref(todayDate, todayDate)}
                    icon={<Building2 size={20} />}
                    value={happeningNow}
                    label={t("admin.stats.happening_now")}
                    hint={t("admin.stats.open_now")}
                    muted={date !== todayDate}
                    note={
                      date !== todayDate
                        ? t("admin.stats.happening_now_note")
                        : undefined
                    }
                  />
                  <Stat
                    to="/admin/bookings?status=pending"
                    icon={<Clock3 size={20} />}
                    value={pending.length}
                    label={t("admin.stats.pending_approval")}
                    hint={t("admin.stats.open_pending")}
                  />
                </div>
                {pendingAccess > 0 && (
                  <Link className="admin-access-notice" to="/admin/users">
                    {t(
                      pendingAccess === 1
                        ? "admin.access_notice_one"
                        : "admin.access_notice_other",
                      { count: pendingAccess },
                    )}
                  </Link>
                )}
                {pending.length > 0 && (
                  <>
                    <div className="section-heading">
                      <h2>{t("admin.pending_section")}</h2>
                      {pending.length > pendingPreview.length && (
                        <NavLink
                          className="text-link"
                          to="/admin/bookings?status=pending"
                        >
                          {t("admin.pending_show_all", {
                            count: pending.length,
                          })}
                          <ArrowUpRight size={16} />
                        </NavLink>
                      )}
                    </div>
                    <div className="admin-booking-list">
                      <AdminBookingList
                        bookings={pendingPreview}
                        rooms={rooms}
                        busy={busy}
                        onOpen={(b) =>
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
                        onApprove={(b) =>
                          run(
                            () => post(`/bookings/${b.id}/approve`),
                            t("admin.toasts.approved"),
                          )
                        }
                        onReject={(b) =>
                          run(
                            () => post(`/bookings/${b.id}/reject`),
                            t("admin.toasts.rejected"),
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="section-heading">
                  <h2>{t("admin.todays_programme")}</h2>
                  {programme.hasMore && (
                    <NavLink className="text-link" to={openCalendar}>
                      {t("admin.programme_show_all", {
                        count: programme.source.length,
                      })}
                      <ArrowUpRight size={16} />
                    </NavLink>
                  )}
                </div>
                {programme.preview.length ? (
                  <div className="admin-booking-list">
                    {programme.preview.map((e) => (
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
                          {e.booking?.editRequested && (
                            <span className="caption">
                              {t("admin.edit_requested")}
                            </span>
                          )}
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
                {programme.hasMore && (
                  <p className="caption admin-programme-more">
                    {t("admin.programme_more", {
                      shown: programme.preview.length,
                      total: programme.source.length,
                    })}
                  </p>
                )}
                <div className="section-heading">
                  <h2>{t("admin.room_calendar")}</h2>
                  <NavLink className="text-link" to={openCalendar}>
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
                  <div className="admin-list-search">
                    <SearchIcon size={18} aria-hidden="true" />
                    <Input
                      type="search"
                      aria-label={t("a11y.search_bookings")}
                      placeholder={t("admin.search_placeholder")}
                      value={term}
                      onChange={(e) =>
                        patchParams({ q: e.target.value || null })
                      }
                    />
                  </div>
                  <FilterSelect
                    label={t("admin.filter_room")}
                    value={roomFilter}
                    onChange={(value) =>
                      patchParams({ rom: value === "all" ? null : value })
                    }
                    options={[
                      {
                        value: "all",
                        label: t("admin.all_rooms"),
                        icon: <Building2 size={18} />,
                      },
                      ...rooms.map((room) => ({
                        value: room.id,
                        label: room.name,
                        icon: <DoorOpen size={18} />,
                      })),
                    ]}
                  />
                  <FilterSelect
                    label={t("a11y.filter_status")}
                    value={statusFilter}
                    onChange={(value) =>
                      patchParams({ status: value === "all" ? null : value })
                    }
                    options={[
                      {
                        value: "all",
                        label: t("admin.all_statuses"),
                        icon: <ListFilter size={18} />,
                      },
                      {
                        value: "confirmed",
                        label: t("common.status.confirmed"),
                        icon: <CheckCircle2 size={18} />,
                      },
                      {
                        value: "pending",
                        label: t("common.status.pending"),
                        icon: <Clock3 size={18} />,
                      },
                      {
                        value: "cancelled",
                        label: t("common.status.cancelled"),
                        icon: <Ban size={18} />,
                      },
                      {
                        value: "rejected",
                        label: t("common.status.rejected"),
                        icon: <CircleX size={18} />,
                      },
                    ]}
                  />
                </div>
                <div className="admin-booking-list">
                  {filteredBookings.length ? (
                    <AdminBookingList
                      bookings={filteredBookings}
                      rooms={rooms}
                      busy={busy}
                      onOpen={(b) =>
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
                      onApprove={(b) =>
                        run(
                          () => post(`/bookings/${b.id}/approve`),
                          t("admin.toasts.approved"),
                        )
                      }
                      onReject={(b) =>
                        run(
                          () => post(`/bookings/${b.id}/reject`),
                          t("admin.toasts.rejected"),
                        )
                      }
                    />
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
                      <div className="admin-room-media">
                        <RoomPhoto room={room} />
                      </div>
                      <div className="admin-room-copy">
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
                        onClick={() => {
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
            {section === "users" && (
              <div className="stack">
                {config?.mode === "live" && <AdminMembers />}
                <AdminAccessRequests result={accessResult} />
              </div>
            )}
            {section === "messages" && <AdminMessages />}
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
                        <dd
                          className={
                            config?.address ? undefined : "settings-missing"
                          }
                        >
                          {config?.address || t("admin.address_missing")}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("admin.settings_contact")}</dt>
                        <dd
                          className={
                            config?.contactEmail
                              ? undefined
                              : "settings-missing"
                          }
                        >
                          {config?.contactEmail || t("admin.address_missing")}
                        </dd>
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
                  <div className="settings-card-body settings-card-action">
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
                    <div className="settings-card-actions">
                      <Link
                        to="/admin/users"
                        className="ds-button"
                        data-variant="secondary"
                      >
                        {t("admin.settings_users_open_inbox")}
                      </Link>
                    </div>
                  </div>
                </section>
                <section className="settings-card settings-card-span">
                  <header className="settings-card-header">
                    <h2>{t("admin.settings_rules")}</h2>
                    <p>{t("admin.settings_rules_caption")}</p>
                  </header>
                  <div className="settings-card-body settings-card-action">
                    <dl className="settings-rules">
                      <div>
                        <dt>{t("admin.settings_rule_approval")}</dt>
                        <dd>
                          <span>{t("admin.settings_rule_approval_value")}</span>
                          <Link to="/admin/rooms">
                            {t("admin.settings_open_rooms")}
                          </Link>
                        </dd>
                      </div>
                      <div>
                        <dt>{t("admin.settings_rule_hours")}</dt>
                        <dd>{t("admin.settings_rule_hours_value")}</dd>
                      </div>
                      <div>
                        <dt>{t("admin.settings_rule_payment")}</dt>
                        <dd>{t("admin.settings_rule_payment_value")}</dd>
                      </div>
                    </dl>
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
                    className="settings-card-span settings-callout"
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
              {event.booking.editRequested && (
                <p className="info-message" role="status">
                  {t("booking.edit_pending_info")}
                </p>
              )}
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
                <a
                  className="ds-button"
                  data-variant="secondary"
                  href={`/api/bookings/${event.id}/calendar.ics`}
                >
                  <Download size={18} />
                  {t("booking.add_to_calendar")}
                </a>
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
            if (!busy) setEditRoom(undefined);
          }}
        >
          <RoomEditForm
            key={editRoom.id}
            room={editRoom}
            mode={config?.mode}
            busy={busy}
            error={error}
            onChange={(next) => setEditRoom(next)}
            onSubmit={(payload) => {
              void run(
                () =>
                  api(`/admin/rooms/${editRoom.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                  }),
                t("admin.toasts.room_updated"),
              );
            }}
          />
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
          <form className="stack block-form" onSubmit={createBlock}>
            <BlockTimeForm
              rooms={rooms}
              roomId={blockRoom || rooms[0]?.id || ""}
              onRoom={setBlockRoom}
              value={blockSearch}
              onChange={setBlockSearch}
              title={blockTitle}
              onTitle={setBlockTitle}
            />
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
  to,
  icon,
  value,
  label,
  hint,
  muted,
  note,
}: {
  to: string;
  icon: ReactNode;
  value: number;
  label: string;
  hint: string;
  muted?: boolean;
  note?: string;
}) {
  return (
    <Link className={`stat${muted ? " is-other-day" : ""}`} to={to}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <span className="stat-note">{note}</span> : null}
      </div>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="visually-hidden">{hint}</span>
    </Link>
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
