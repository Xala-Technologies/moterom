import { Link, Navigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useApp } from "../context";
import { useApi } from "../api";
import { Empty, ErrorState, Loading } from "../components/ui";
import { MessageThread } from "../components/MessageThread";
import type { ConversationSummary } from "../../shared/types";
import { useFormatters, useT } from "../i18n";
import { useState } from "react";

export function Messages() {
  const { user, loading } = useApp();
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const result = useApi<ConversationSummary[]>(user ? "/messages" : null);
  const [selected, setSelected] = useState<string>();
  if (loading) return <Loading />;
  if (!user) return <Navigate replace to="/login?returnTo=/meldinger" />;
  if (user.isAdmin) return <Navigate replace to="/admin/messages" />;
  const rows = result.data || [];
  const active =
    selected && rows.some((r) => r.id === selected) ? selected : rows[0]?.id;
  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("dashboard.eyebrow")}</span>
          <h1>{t("messages.heading")}</h1>
          <p>{t("messages.intro")}</p>
        </div>
        <Link
          className="ds-button"
          data-variant="secondary"
          to="/mine-bookinger"
        >
          {t("dashboard.nav")}
        </Link>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : rows.length === 0 ? (
        <Empty
          icon={<MessageCircle size={36} />}
          title={t("messages.empty_title")}
        >
          <p>{t("messages.empty_body")}</p>
          <Link className="ds-button" to="/mine-bookinger">
            {t("dashboard.nav")}
          </Link>
        </Empty>
      ) : (
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
                  <strong>{row.subject || row.roomName}</strong>
                  <span className="muted">
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
            <h2>{rows.find((r) => r.id === active)?.subject}</h2>
            <MessageThread
              endpoint={active ? `/messages/${active}` : null}
              emptyHint={t("messages.empty_thread")}
              onSent={result.reload}
            />
          </section>
        </div>
      )}
    </div>
  );
}
