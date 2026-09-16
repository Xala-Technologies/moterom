import { useState } from "react";
import { Building2 } from "lucide-react";
import type { Room } from "../../shared/types";

export function RoomPhoto({
  room,
  variant,
}: {
  room: Room;
  variant: "card" | "detail";
}) {
  const [failed, setFailed] = useState(false);
  const illustrative = room.imageKind !== "actual";
  const showImage = Boolean(room.image) && !failed;
  const className = `${variant === "card" ? "room-image" : "detail-image"} ${showImage ? "" : "no-photo"}`;
  const alt =
    variant === "card"
      ? ""
      : illustrative
        ? `${room.name} (illustrasjonsfoto)`
        : room.name;
  return (
    <div className={className}>
      {showImage ? (
        <>
          <img
            src={room.image}
            alt={alt}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
          {illustrative && (
            <span className="photo-credit">Illustrasjonsfoto</span>
          )}
        </>
      ) : (
        <>
          <Building2 size={variant === "card" ? 38 : 64} strokeWidth={1.3} />
          <span>{room.name}</span>
          {variant === "detail" && <small>Romfoto kommer</small>}
        </>
      )}
    </div>
  );
}
