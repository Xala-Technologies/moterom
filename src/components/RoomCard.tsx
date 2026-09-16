import { Link } from "react-router-dom";
import { ArrowRight, UsersRound } from "lucide-react";
import type { Availability, Room } from "../../shared/types";
import { RoomPhoto } from "./RoomPhoto";
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
}: {
  room: Room;
  availability?: Availability;
  query?: string;
  list?: boolean;
  selected?: boolean;
  action?: { to: string; label: string; ariaLabel: string };
}) {
  const { t } = useT();
  const { locale } = useI18nLocale();
  const copy = roomCopy(room, locale);
  const href = action?.to ?? bookHref(room.id, query);
  const label = action?.label ?? t("rooms.book_now");
  const ariaLabel =
    action?.ariaLabel ?? t("rooms.book_room_aria", { name: room.name });
  return (
    <article
      className={`room-card ${list ? "room-row" : ""}${selected ? " is-selected" : ""}`}
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
      </div>
    </article>
  );
}
