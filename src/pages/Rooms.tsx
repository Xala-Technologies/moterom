import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
} from "lucide-react";
import { useApi } from "../api";
import { Button, Empty, ErrorState, Loading, Modal } from "../components/ui";
import { RoomCard } from "../components/RoomCard";
import { BookingConfirmModal } from "../components/BookingConfirmModal";
import { MonthCalendar } from "../components/MonthCalendar";
import type { RoomSlotSelection } from "../components/RoomCardSchedule";
import type { Room, Search } from "../../shared/types";
import { addDays, defaultSearch, today } from "../../shared/time";
import {
  PHYSICAL_SAL_ZONES,
  SAL_ROOM_IDS,
  isSalRoom,
  selectedPhysicalZones,
} from "../../shared/zones";
import { useApp } from "../context";
import { useFormatters, useT } from "../i18n";

const SAL_FILTER_ORDER = SAL_ROOM_IDS;

const ZONE_LABELS: Record<(typeof PHYSICAL_SAL_ZONES)[number], string> = {
  "sal-1": "Sal 1",
  "sal-2": "Sal 2",
  "sal-3": "Sal 3",
};

/** Drop in-progress slot picks when the shared halls date changes. */
export function resetSlotSelections(): Record<
  string,
  RoomSlotSelection | null
> {
  return {};
}

export function productChipLabel(
  roomId: string,
  name: string,
  heleSalen: string,
): string {
  return roomId === "sal-1-3" ? heleSalen : name;
}

export function readSearch(params: URLSearchParams): Search {
  const d = defaultSearch();
  return {
    date: params.get("date") || d.date,
    start: params.get("start") || d.start,
    end: params.get("end") || d.end,
    people: 1,
  };
}

export function Rooms() {
  const { config } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
  const [floorplan, setFloorplan] = useState(false);
  // One shared date for every card so slot picks and booking stay aligned.
  const [selectedDate, setSelectedDate] = useState(today);
  const [salFilter, setSalFilter] = useState<string>("all");
  const [dateOpen, setDateOpen] = useState(false);
  const [selections, setSelections] = useState<
    Record<string, RoomSlotSelection | null>
  >({});
  const [purposeByRoom, setPurposeByRoom] = useState<Record<string, string>>(
    {},
  );
  const [confirm, setConfirm] = useState<{
    roomId: string;
    selection: RoomSlotSelection;
  } | null>(null);
  const [slotsRevision, setSlotsRevision] = useState(0);
  const rooms = useApi<Room[]>("/rooms");

  const confirmRoom = rooms.data?.find((r) => r.id === confirm?.roomId);
  const roomList = rooms.data || [];
  const hasSalRooms = roomList.some((r) => isSalRoom(r.id));
  const salRooms = useMemo(
    () =>
      SAL_FILTER_ORDER.map((id) => roomList.find((r) => r.id === id)).filter(
        (r): r is Room => Boolean(r),
      ),
    [roomList],
  );

  const highlightedZones = selectedPhysicalZones(salFilter);

  const productHintKey =
    salFilter === "sal-1-2"
      ? "rooms.halls_hint_sal_1_2"
      : salFilter === "sal-1-3"
        ? "rooms.halls_hint_sal_1_3"
        : salFilter === "sal-1" ||
            salFilter === "sal-2" ||
            salFilter === "sal-3"
          ? "rooms.halls_hint_single"
          : "rooms.halls_hint_all";

  const visibleRooms = roomList.filter((room) => {
    if (!isSalRoom(room.id)) return true;
    if (salFilter === "all") return true;
    return room.id === salFilter;
  });

  const changeDate = (date: string) => {
    setSelectedDate(date);
    setSelections(resetSlotSelections());
    setSlotsRevision((n) => n + 1);
    setDateOpen(false);
  };

  const onBooked = () => {
    setSelections(resetSlotSelections());
    setConfirm(null);
    // Zone conflicts change other halls — reload every card’s slots.
    setSlotsRevision((n) => n + 1);
  };

  const minDate = today();

  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <h1>{t("rooms.heading")}</h1>
          <p>{t("rooms.intro")}</p>
          {config?.access === "public" ? (
            <p className="caption">{t("rooms.open_access_hint")}</p>
          ) : null}
          {rooms.data ? (
            <p className="page-heading-count">
              {t("rooms.room_count", { count: rooms.data.length })}
            </p>
          ) : null}
        </div>
        {config?.floorplanAvailable && (
          <Button
            variant="secondary"
            data-size="sm"
            onClick={() => setFloorplan(true)}
          >
            <MapIcon size={18} />
            {t("rooms.floorplan")}
          </Button>
        )}
      </div>
      {rooms.error ? (
        <ErrorState error={rooms.error} retry={rooms.reload} />
      ) : rooms.loading ? (
        <Loading label={t("rooms.loading_rooms")} />
      ) : roomList.length ? (
        <>
          {hasSalRooms ? (
            <aside
              className="halls-filter"
              aria-labelledby="halls-filter-title"
            >
              <h2 id="halls-filter-title">{t("rooms.halls_title")}</h2>
              <p className="halls-filter-lead">{t("rooms.halls_body")}</p>
              <p className="caption">{t("rooms.halls_zones_caption")}</p>
              <div
                className="halls-zone-strip"
                role="group"
                aria-label={t("rooms.halls_zones_aria")}
              >
                {PHYSICAL_SAL_ZONES.map((zoneId) => {
                  const selected = highlightedZones.has(zoneId);
                  return (
                    <div
                      key={zoneId}
                      className={`halls-zone-cell${selected ? " is-selected" : ""}`}
                    >
                      <span className="halls-zone-name">
                        {ZONE_LABELS[zoneId]}
                      </span>
                      <span className="halls-zone-state">
                        {selected
                          ? t("rooms.halls_zone_selected")
                          : t("rooms.halls_zone_not_selected")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="caption halls-zone-note">
                {t("rooms.halls_zones_illustration_note")}
              </p>
              <div
                className="pill-tabs halls-filter-tabs"
                role="group"
                aria-label={t("rooms.halls_filter_aria")}
              >
                <button
                  type="button"
                  aria-pressed={salFilter === "all"}
                  onClick={() => setSalFilter("all")}
                >
                  {t("rooms.halls_filter_all")}
                </button>
                {salRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    aria-pressed={salFilter === room.id}
                    onClick={() => setSalFilter(room.id)}
                  >
                    {productChipLabel(
                      room.id,
                      room.name,
                      t("rooms.halls_filter_full"),
                    )}
                  </button>
                ))}
              </div>
              <p className="halls-product-hint" role="status">
                {t(productHintKey)}
              </p>
              <div className="halls-filter-date">
                <span className="halls-filter-date-label">
                  {t("rooms.halls_selected_date")}
                </span>
                <div className="room-schedule-date-row">
                  <Button
                    type="button"
                    variant="secondary"
                    icon
                    className="room-date-step"
                    aria-label={t("a11y.previous_day")}
                    disabled={selectedDate <= minDate}
                    onClick={() => changeDate(addDays(selectedDate, -1))}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </Button>
                  <button
                    type="button"
                    className="room-date-trigger"
                    aria-expanded={dateOpen}
                    aria-haspopup="dialog"
                    aria-label={`${t("common.date")}: ${displayDate(selectedDate, true)}`}
                    onClick={() => setDateOpen((open) => !open)}
                  >
                    <span>{displayDate(selectedDate, true)}</span>
                    <CalendarDays aria-hidden size={20} />
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    icon
                    className="room-date-step"
                    aria-label={t("a11y.next_day")}
                    onClick={() => changeDate(addDays(selectedDate, 1))}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </Button>
                </div>
                {dateOpen ? (
                  <div
                    className="room-date-popover halls-filter-calendar"
                    role="dialog"
                    aria-label={t("a11y.pick_date")}
                  >
                    <MonthCalendar value={selectedDate} onChange={changeDate} />
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
          <div className="rooms-grid">
            {visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                scheduleDate={selectedDate}
                onScheduleDateChange={changeDate}
                selection={selections[room.id] ?? null}
                onSelectSlot={(next) => {
                  setSelections((prev) => ({ ...prev, [room.id]: next }));
                  if (next) setConfirm({ roomId: room.id, selection: next });
                }}
                slotsRevision={slotsRevision}
              />
            ))}
          </div>
        </>
      ) : (
        <Empty icon={<CalendarDays size={32} />} title={t("rooms.empty_title")}>
          <p>{t("rooms.empty_body")}</p>
        </Empty>
      )}
      {floorplan && (
        <Modal
          title={t("rooms.floorplan")}
          close={() => setFloorplan(false)}
          wide
        >
          <img
            className="floorplan"
            src="/api/floorplan"
            alt={t("rooms.floorplan_alt")}
          />
          <p className="muted">{t("rooms.floorplan_note")}</p>
        </Modal>
      )}
      {confirm && confirmRoom && (
        <BookingConfirmModal
          room={confirmRoom}
          selection={confirm.selection}
          purpose={purposeByRoom[confirmRoom.id] ?? ""}
          onPurposeChange={(value) =>
            setPurposeByRoom((prev) => ({
              ...prev,
              [confirmRoom.id]: value,
            }))
          }
          close={() => setConfirm(null)}
          onSuccess={onBooked}
        />
      )}
    </div>
  );
}
