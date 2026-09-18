import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useApi } from "../../api";
import { Empty, ErrorState, Loading } from "../ui";
import { MessageThread } from "../MessageThread";
import type { ConversationSummary } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";

export function AdminMessages() {
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const result = useApi<ConversationSummary[]>("/admin/messages");
  const [selected, setSelected] = useState<string>();
  if (result.loading) return <Loading />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  const rows = result.data || [];
  const active =
    selected && rows.some((r) => r.id === selected) ? selected : rows[0]?.id;
  if (!rows.length)
    return (
      <Empty
        icon={<MessageCircle size={36} />}
        title={t("messages.empty_admin_title")}
      >
        <p>{t("messages.empty_admin_body")}</p>
      </Empty>
    );
  return (
    <div className="message-inbox">
      <ul className="message-inbox-list">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={row.id === active ? "active" : undefined}
              aria-current={row.id === active ? "true" : undefined}
              onClick={() => setSelected(row.id)}
            >
              <strong>
                {row.customerName || t("messages.customer_fallback")}
              </strong>
              <span className="muted">
                {row.roomName}
                {row.unread > 0 ? ` · ${row.unread}` : ""}
              </span>
              <span>
                {displayDate(row.updatedAt)} {shortTime(row.updatedAt)}
              </span>
              {row.preview ? <span>{row.preview}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <section
        className="booking-info-panel"
        aria-label={t("messages.thread_aria")}
      >
        <h2>
          {rows.find((r) => r.id === active)?.subject || t("messages.heading")}
        </h2>
        <MessageThread
          endpoint={active ? `/admin/messages/${active}` : null}
          emptyHint={t("messages.empty_thread")}
          onSent={result.reload}
        />
      </section>
    </div>
  );
}
