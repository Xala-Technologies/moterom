import { Link } from "react-router-dom";
import { ArrowRight, UsersRound } from "lucide-react";
import type { Availability, Room } from "../../shared/types";
import { RoomPhoto } from "./RoomPhoto";
export function RoomCard({
  room,
  availability,
  query = "",
  list = false,
}: {
  room: Room;
  availability?: Availability;
  query?: string;
  list?: boolean;
}) {
  const href = `/rom/${room.id}${query ? `?${query}` : ""}`;
  return (
    <article className={`room-card ${list ? "room-row" : ""}`}>
      <Link to={href} className="room-media" tabIndex={-1} aria-hidden="true">
        <RoomPhoto room={room} variant="card" />
      </Link>
      <div className="room-card-content">
        <div className="room-card-top">
          <span className="eyebrow">Møterom</span>
          {availability && (
            <span className={`availability-badge ${availability.state}`}>
              {availability.state === "available"
                ? "Ledig"
                : availability.state === "error"
                  ? "Ukjent ledighet"
                  : "Ikke ledig"}
            </span>
          )}
        </div>
        <h2>
          <Link to={href}>{room.name}</Link>
        </h2>
        <p className="room-capacity">
          <UsersRound size={17} />
          {room.capacityLabel}
        </p>
        <p className="room-description">{room.description}</p>
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
              ? "Ledig hele tidsrommet"
              : availability?.state === "unavailable"
                ? "Se andre tidspunkt"
                : availability?.state === "error"
                  ? "Prøv ledighetssøket igjen"
                  : "Velg tidspunkt for ledighet"}
          </span>
          <Link
            to={href}
            className="room-action"
            aria-label={`Se ${room.name}`}
          >
            {availability?.state === "available" ? "Velg rom" : "Se rom"}
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
