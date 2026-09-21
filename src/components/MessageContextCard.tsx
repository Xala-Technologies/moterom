import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import type { ConversationSummary, Room } from "../../shared/types";
import { RoomPhoto } from "./RoomPhoto";
import { Status } from "./ui";
import { useFormatters, useI18nLocale, useT } from "../i18n";

function roomFromContext(conversation: ConversationSummary): Room | null {
  const ctx = conversation.context;
  if (!ctx?.roomId) return null;
  return {
    id: ctx.roomId,
    name: ctx.roomName,
    slug: ctx.roomId,
    capacity: ctx.capacity || 1,
    capacityLabel: ctx.capacityLabel || "",
    capacityLabelEn: ctx.capacityLabelEn || "",
    description: "",
    descriptionEn: "",
    amenities: [],
    requiresApproval: false,
    image: ctx.image,
    imageKind: ctx.imageKind,
  };
}

export function MessageContextCard({
  conversation,
  admin = false,
}: {
  conversation: ConversationSummary;
  admin?: boolean;
}) {
  const { t } = useT();
  const { locale } = useI18nLocale();
  const { displayDate, shortTime } = useFormatters();
  const kind = conversation.kind || "booking";

  if (kind === "support") {
    return (
      <aside className="message-context message-context-support">
        <MessageCircle size={20} aria-hidden="true" />
        <div>
          <strong>{t("messages.kind_support")}</strong>
          <p className="muted">{t("messages.support_context_body")}</p>
        </div>
      </aside>
    );
  }

  const room = roomFromContext(conversation);
  const ctx = conversation.context;
  const capacityLabel =
    locale === "en"
      ? ctx?.capacityLabelEn || ctx?.capacityLabel
      : ctx?.capacityLabel || ctx?.capacityLabelEn;
  const bookingHref = ctx?.bookingId
    ? admin
      ? `/admin/bookings?q=${encodeURIComponent(ctx.reference || ctx.bookingId)}`
      : `/booking/${encodeURIComponent(ctx.bookingId)}`
    : undefined;

  return (
    <aside className="message-context message-context-booking">
      {room ? (
        <div className="message-context-photo">
          <RoomPhoto room={room} />
        </div>
      ) : null}
      <div className="message-context-body">
        <strong>{ctx?.roomName || conversation.roomName}</strong>
        {capacityLabel ? <p className="muted">{capacityLabel}</p> : null}
        {ctx?.startTime && ctx?.endTime ? (
          <p>
            {displayDate(ctx.startTime)} {shortTime(ctx.startTime)}–
            {shortTime(ctx.endTime)}
          </p>
        ) : null}
        {ctx?.status ? <Status status={ctx.status} /> : null}
        {ctx?.reference ? (
          <p className="muted">
            {t("messages.booking_reference", { reference: ctx.reference })}
          </p>
        ) : null}
        {bookingHref ? (
          <Link className="text-link" to={bookingHref}>
            {t("messages.open_booking")}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
