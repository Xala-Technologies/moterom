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
  selected = false,
  action,
  scheduleDate,
  onScheduleDateChange,
  selection,
  onSelectSlot,
  slotsRevision = 0,
}: {
  room: Room;
  availability?: Availability;
  query?: string;
  selected?: boolean;
  action?: { to: string; label: string; ariaLabel: string };
  scheduleDate?: string;
  onScheduleDateChange?: (date: string) => void;
  selection?: RoomSlotSelection | null;
  onSelectSlot?: (next: RoomSlotSelection | null) => void;
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
    scheduleDate !== undefined && onScheduleDateChange && onSelectSlot;

  return (
    <article
      className={`room-card${selected ? " is-selected" : ""}${showSchedule ? " has-schedule" : ""}`}
    >
      <div className="room-media">
        <RoomPhoto room={room} />
      </div>
      <div className="room-card-content">
        {availability && (
          <div className="room-card-top">
            <span className={`availability-badge ${availability.state}`}>
              {availability.state === "available"
                ? t("rooms.available")
                : availability.state === "error"
                  ? t("rooms.availability_unknown")
                  : t("rooms.unavailable")}
            </span>
          </div>
        )}
        <div className="room-card-heading">
          <h2>{room.name}</h2>
          <p className="room-capacity">
            <UsersRound size={17} aria-hidden="true" />
            {copy.capacityLabel}
          </p>
        </div>
        <p className="room-description">{copy.description}</p>
        <div
          className="amenities"
          aria-hidden={room.amenities.length === 0 ? true : undefined}
        >
          {room.amenities.slice(0, 3).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        {showSchedule ? (
          <RoomCardSchedule
            roomId={room.id}
            date={scheduleDate}
            onDateChange={onScheduleDateChange}
            selection={selection ?? null}
            onSelect={onSelectSlot}
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
