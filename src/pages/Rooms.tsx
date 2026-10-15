import { useState } from "react";
import { CalendarDays, Map as MapIcon } from "lucide-react";
import { useApi } from "../api";
import { Button, Empty, ErrorState, Loading, Modal } from "../components/ui";
import { RoomCard } from "../components/RoomCard";
import { BookingConfirmModal } from "../components/BookingConfirmModal";
import type { RoomSlotSelection } from "../components/RoomCardSchedule";
import type { Room, Search } from "../../shared/types";
import { defaultSearch, today } from "../../shared/time";
import { useApp } from "../context";
import { useT } from "../i18n";

/** Drop in-progress slot picks when the shared date changes. */
export function resetSlotSelections(): Record<
  string,
  RoomSlotSelection | null
> {
  return {};
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
  const [floorplan, setFloorplan] = useState(false);
  // One shared date for every card so slot picks and booking stay aligned.
  const [selectedDate, setSelectedDate] = useState(today);
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

  const changeDate = (date: string) => {
    setSelectedDate(date);
    setSelections(resetSlotSelections());
    setSlotsRevision((n) => n + 1);
  };

  const onBooked = () => {
    setSelections(resetSlotSelections());
    // Keep the confirm modal open so it can show the registered booking.
    // Zone conflicts change other halls — reload every card’s slots.
    setSlotsRevision((n) => n + 1);
  };

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
        <div className="rooms-grid">
          {roomList.map((room) => (
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
