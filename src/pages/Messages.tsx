import { Navigate } from "react-router-dom";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useApp } from "../context";
import { post, useApi } from "../api";
import { Button, Empty, ErrorState, Loading } from "../components/ui";
import { MessageThread } from "../components/MessageThread";
import { MessageContextCard } from "../components/MessageContextCard";
import { messageInitials } from "../components/messageIdentity";
import type {
  ConversationSummary,
  ConversationThread,
} from "../../shared/types";
import { useFormatters, useT } from "../i18n";
import { useEffect, useState } from "react";

export function Messages() {
  const { user, loading, notify } = useApp();
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const result = useApi<ConversationSummary[]>(user ? "/messages" : null);
  const [selected, setSelected] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<Error>();
  const [phoneThreadOpen, setPhoneThreadOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!result.data) return;
    setSelected((current) => {
      const stillThere =
        current && result.data!.some((row) => row.id === current);
      if (stillThere) return current;
      if (narrow) return undefined;
      return result.data![0]?.id;
    });
  }, [narrow, result.data]);

  if (loading) return <Loading />;
  if (!user) return <Navigate replace to="/login?returnTo=/meldinger" />;
  if (user.isAdmin) return <Navigate replace to="/admin/messages" />;

  const rows = result.data || [];
  const selectedKnown =
    selected && rows.some((row) => row.id === selected) ? selected : undefined;
  const active = selectedKnown
    ? narrow
      ? phoneThreadOpen
        ? selectedKnown
        : undefined
      : selectedKnown
    : narrow
      ? undefined
      : rows[0]?.id;
  const activeRow = rows.find((row) => row.id === active);
  const showThread = Boolean(active) && (!narrow || phoneThreadOpen);

  const listLabel = (row: ConversationSummary) =>
    row.kind === "support"
      ? t("messages.kind_support")
      : row.subject || row.roomName;

  const openRow = (id: string) => {
    setSelected(id);
    if (narrow) setPhoneThreadOpen(true);
  };

  const startSupport = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(undefined);
    try {
      const existing = rows.find((row) => row.kind === "support");
      if (existing) {
        openRow(existing.id);
        return;
      }
      const thread = await post<ConversationThread>("/messages/support", {});
      await result.reload();
      if (thread.conversation?.id) openRow(thread.conversation.id);
      notify(t("messages.support_started"));
    } catch (err) {
      setStartError(err as Error);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="customer-messages-page">
      <header className="customer-messages-heading">
        <div>
          <h1>{t("messages.heading")}</h1>
          <p>{t("messages.intro")}</p>
        </div>
        <div className="customer-messages-heading-actions">
          <Button
            type="button"
            disabled={starting || result.loading}
            onClick={() => void startSupport()}
          >
            <MessageCircle size={16} />
            {starting ? t("common.sending") : t("messages.contact_us")}
          </Button>
        </div>
      </header>

      {startError ? <ErrorState error={startError} /> : null}

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
          <Button
            type="button"
            disabled={starting}
            onClick={() => void startSupport()}
          >
            {t("messages.contact_us")}
          </Button>
        </Empty>
      ) : (
        <div
          className="customer-messages"
          data-narrow={narrow ? "true" : "false"}
          data-phone-pane={phoneThreadOpen ? "thread" : "list"}
        >
          <section
            className="customer-messages-list"
            aria-label={t("messages.list_aria")}
          >
            <div className="customer-messages-list-head">
              <h2>{t("messages.list_count", { count: rows.length })}</h2>
            </div>
            <ul>
              {rows.map((row) => {
                const label = listLabel(row);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={
                        row.id === active
                          ? "customer-messages-row active"
                          : "customer-messages-row"
                      }
                      aria-current={row.id === active ? "true" : undefined}
                      onClick={() => openRow(row.id)}
                    >
                      <span
                        className={
                          row.kind === "support"
                            ? "customer-messages-avatar support"
                            : "customer-messages-avatar"
                        }
                        aria-hidden="true"
                      >
                        {row.kind === "support" ? (
                          <MessageCircle size={18} />
                        ) : (
                          messageInitials(label)
                        )}
                      </span>
                      <span className="customer-messages-row-body">
                        <span className="customer-messages-row-top">
                          <strong>{label}</strong>
                          <time
                            dateTime={new Date(row.updatedAt).toISOString()}
                          >
                            {displayDate(row.updatedAt)}{" "}
                            {shortTime(row.updatedAt)}
                          </time>
                        </span>
                        {row.kind === "booking" &&
                        row.roomName &&
                        row.roomName !== label ? (
                          <span className="customer-messages-row-meta">
                            {row.roomName}
                          </span>
                        ) : null}
                        {row.preview ? (
                          <span className="customer-messages-row-preview">
                            {row.preview}
                          </span>
                        ) : null}
                        {row.unread > 0 ? (
                          <span className="customer-messages-row-unread">
                            {t("messages.unread", { count: row.unread })}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="customer-messages-thread"
            aria-label={t("messages.thread_aria")}
          >
            {showThread && activeRow ? (
              <>
                <header className="customer-messages-thread-header">
                  {narrow ? (
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      type="button"
                      className="customer-messages-back"
                      onClick={() => setPhoneThreadOpen(false)}
                    >
                      <ChevronLeft size={18} />
                      {t("messages.back_to_list")}
                    </Button>
                  ) : null}
                  <h2>{listLabel(activeRow)}</h2>
                  <p className="muted">
                    {displayDate(activeRow.updatedAt)}{" "}
                    {shortTime(activeRow.updatedAt)}
                  </p>
                  <MessageContextCard conversation={activeRow} />
                </header>
                <MessageThread
                  fill
                  endpoint={`/messages/${activeRow.id}`}
                  emptyHint={t("messages.empty_thread")}
                  onSent={result.reload}
                />
              </>
            ) : (
              <div className="customer-messages-thread-empty">
                <p className="muted">{t("messages.select_conversation")}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
