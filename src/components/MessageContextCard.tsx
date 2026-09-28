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
  const roomName = ctx?.roomName || conversation.roomName;
  const capacityLabel =
    locale === "en"
      ? ctx?.capacityLabelEn || ctx?.capacityLabel
      : ctx?.capacityLabel || ctx?.capacityLabelEn;
  const whenLabel =
    ctx?.startTime && ctx?.endTime
      ? `${displayDate(ctx.startTime)} ${shortTime(ctx.startTime)}–${shortTime(ctx.endTime)}`
      : null;
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
        <strong>{roomName}</strong>
        <dl className="message-context-meta">
          {capacityLabel ? (
            <>
              <dt>{t("messages.context_capacity")}</dt>
              <dd>{capacityLabel}</dd>
            </>
          ) : null}
          {whenLabel ? (
            <>
              <dt>{t("messages.context_when")}</dt>
              <dd>{whenLabel}</dd>
            </>
          ) : null}
          {ctx?.status ? (
            <>
              <dt>{t("messages.context_status")}</dt>
              <dd>
                <Status status={ctx.status} />
              </dd>
            </>
          ) : null}
          {ctx?.reference ? (
            <>
              <dt>{t("messages.context_reference")}</dt>
              <dd>{ctx.reference}</dd>
            </>
          ) : null}
        </dl>
        {bookingHref ? (
          <Link className="text-link" to={bookingHref}>
            {t("messages.open_booking")}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
