import { Link } from "react-router-dom";
import { ArrowRight, UsersRound } from "lucide-react";
import type { Availability, Room } from "../../shared/types";
import { RoomPhoto } from "./RoomPhoto";
import { RoomCardSchedule, type RoomSlotSelection } from "./RoomCardSchedule";
import { roomCopy, useI18nLocale, useT } from "../i18n";

export function bookHref(roomId: string, query = "") {
  const params = new URLSearchParams(query);
  params.set("rom", roomId);
  return `/ny-booking?${params}`;
}

export function RoomCard({
  room,
  availability,
  query = "",
  list = false,
  selected = false,
  action,
  scheduleDate,
  onScheduleDateChange,
  selection,
  onSelectSlot,
  onBook,
  slotsRevision = 0,
}: {
  room: Room;
  availability?: Availability;
  query?: string;
  list?: boolean;
  selected?: boolean;
  action?: { to: string; label: string; ariaLabel: string };
  scheduleDate?: string;
  onScheduleDateChange?: (date: string) => void;
  selection?: RoomSlotSelection | null;
  onSelectSlot?: (next: RoomSlotSelection | null) => void;
  onBook?: () => void;
  slotsRevision?: number;
}) {
  const { t } = useT();
  const { locale } = useI18nLocale();
  const copy = roomCopy(room, locale);
  const href = action?.to ?? bookHref(room.id, query);
  const label = action?.label ?? t("rooms.book_now");
  const ariaLabel =
    action?.ariaLabel ?? t("rooms.book_room_aria", { name: room.name });
  const showSchedule =
    !list &&
    scheduleDate !== undefined &&
    onScheduleDateChange &&
    onSelectSlot &&
    onBook;

  return (
    <article
      className={`room-card ${list ? "room-row" : ""}${selected ? " is-selected" : ""}${showSchedule ? " has-schedule" : ""}`}
    >
      <div className="room-media">
        <RoomPhoto room={room} />
      </div>
      <div className="room-card-content">
        <div className="room-card-top">
          <span className="eyebrow">{t("common.meeting_room")}</span>
          {availability && (
            <span className={`availability-badge ${availability.state}`}>
              {availability.state === "available"
                ? t("rooms.available")
                : availability.state === "error"
                  ? t("rooms.availability_unknown")
                  : t("rooms.unavailable")}
            </span>
          )}
        </div>
        <h2>{room.name}</h2>
        <p className="room-capacity">
          <UsersRound size={17} />
          {copy.capacityLabel}
        </p>
        <p className="room-description">{copy.description}</p>
        {room.amenities.length > 0 && (
          <div className="amenities">
            {room.amenities.slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
        {showSchedule ? (
          <RoomCardSchedule
            roomId={room.id}
            date={scheduleDate}
            onDateChange={onScheduleDateChange}
            selection={selection ?? null}
            onSelect={onSelectSlot}
            onBook={onBook}
            moreHref={href}
            slotsRevision={slotsRevision}
          />
        ) : (
          <div className="room-card-footer">
            <span className="caption">
              {availability?.state === "available"
                ? t("rooms.caption_available")
                : availability?.state === "unavailable"
                  ? t("rooms.caption_unavailable")
                  : availability?.state === "error"
                    ? t("rooms.caption_error")
                    : t("rooms.caption_default")}
            </span>
            <Link to={href} className="room-action" aria-label={ariaLabel}>
              {label}
              <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
