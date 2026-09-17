import { useEffect, useState } from "react";
import { CalendarDays, Grid2X2, List, Map as MapIcon } from "lucide-react";
import { useApi } from "../api";
import { Button, Empty, ErrorState, Loading, Modal } from "../components/ui";
import { RoomCard } from "../components/RoomCard";
import { BookingConfirmModal } from "../components/BookingConfirmModal";
import type { RoomSlotSelection } from "../components/RoomCardSchedule";
import type { Room, Search } from "../../shared/types";
import { defaultSearch, today } from "../../shared/time";
import { useApp } from "../context";
import { useT } from "../i18n";

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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [floorplan, setFloorplan] = useState(false);
  const pageDate = today();
  const [cardDates, setCardDates] = useState<Record<string, string>>({});
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
  const [slotsRevision, setSlotsRevision] = useState<Record<string, number>>(
    {},
  );
  const rooms = useApi<Room[]>("/rooms");

  useEffect(() => {
    setCardDates((prev) => {
      const next: Record<string, string> = {};
      for (const room of rooms.data || []) {
        next[room.id] = prev[room.id] ?? pageDate;
      }
      return next;
    });
  }, [pageDate, rooms.data]);

  const confirmRoom = rooms.data?.find((r) => r.id === confirm?.roomId);
  const roomList = rooms.data || [];

  const onBooked = (roomId: string) => {
    setSelections((prev) => ({ ...prev, [roomId]: null }));
    setSlotsRevision((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? 0) + 1,
    }));
  };

  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <h1>{t("rooms.heading")}</h1>
          <p>{t("rooms.intro")}</p>
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
      <div className="results-heading">
        <div>
          <h2>{t("rooms.our_rooms")}</h2>
          <span className="muted">
            {t("rooms.rooms_summary", {
              count: rooms.data?.length ?? 7,
            })}
          </span>
        </div>
        <div
          className="view-switch"
          role="group"
          aria-label={t("a11y.view_mode")}
        >
          <button
            aria-label={t("a11y.grid_view")}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={19} />
          </button>
          <button
            aria-label={t("a11y.list_view")}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={20} />
          </button>
        </div>
      </div>
      {rooms.error ? (
        <ErrorState error={rooms.error} retry={rooms.reload} />
      ) : rooms.loading ? (
        <Loading label={t("rooms.loading_rooms")} />
      ) : roomList.length ? (
        <div className={`rooms-grid ${view === "list" ? "rooms-list" : ""}`}>
          {roomList.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              list={view === "list"}
              scheduleDate={cardDates[room.id] ?? pageDate}
              onScheduleDateChange={(date) =>
                setCardDates((prev) => ({ ...prev, [room.id]: date }))
              }
              selection={selections[room.id] ?? null}
              onSelectSlot={(next) =>
                setSelections((prev) => ({ ...prev, [room.id]: next }))
              }
              onBook={() => {
                const selection = selections[room.id];
                if (!selection) return;
                setConfirm({ roomId: room.id, selection });
              }}
              slotsRevision={slotsRevision[room.id] ?? 0}
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
          onSuccess={() => onBooked(confirmRoom.id)}
        />
      )}
    </div>
  );
}
