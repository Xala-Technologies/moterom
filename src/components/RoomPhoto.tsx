import { useState } from "react";
import { Building2 } from "lucide-react";
import type { Room } from "../../shared/types";
import { useT } from "../i18n";

export function RoomPhoto({ room }: { room: Room }) {
  const { t } = useT();
  const [failed, setFailed] = useState(false);
  const illustrative = room.imageKind !== "actual";
  const showImage = Boolean(room.image) && !failed;
  const className = `room-image ${showImage ? "" : "no-photo"}`;
  return (
    <div className={className}>
      {showImage ? (
        <>
          <img
            src={room.image}
            alt=""
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
          {illustrative && (
            <span className="photo-credit">{t("rooms.photo_credit")}</span>
          )}
        </>
      ) : (
        <>
          <Building2 size={38} strokeWidth={1.3} />
          <span>{room.name}</span>
        </>
      )}
    </div>
  );
}
