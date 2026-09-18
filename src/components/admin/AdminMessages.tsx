import { useEffect, useState } from "react";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useApi } from "../../api";
import { Button, Empty, ErrorState, Field, Input, Label, Loading } from "../ui";
import { MessageThread } from "../MessageThread";
import type { ConversationSummary } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function matchesQuery(row: ConversationSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.customerName, row.roomName, row.subject, row.preview]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function AdminMessages() {
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const result = useApi<ConversationSummary[]>("/admin/messages");
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
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

  if (result.loading) return <Loading />;
  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;

  const rows = result.data || [];
  const unreadCount = rows.filter((row) => row.unread > 0).length;
  const filtered = rows.filter((row) => {
    if (unreadOnly && row.unread <= 0) return false;
    return matchesQuery(row, query);
  });
  const visible = new Set(filtered.map((row) => row.id));
  const selectedVisible =
    selected && visible.has(selected) ? selected : undefined;
  const active = selectedVisible
    ? selectedVisible
    : narrow
      ? phoneThreadOpen && selected && rows.some((row) => row.id === selected)
        ? selected
        : undefined
      : filtered[0]?.id;
  const activeRow = rows.find((row) => row.id === active);
  const showThread = Boolean(active) && (!narrow || phoneThreadOpen);

  const openRow = (id: string) => {
    setSelected(id);
    if (narrow) setPhoneThreadOpen(true);
  };

  const emptyList =
    rows.length === 0 ? (
      <Empty
        icon={<MessageCircle size={36} />}
        title={t("messages.empty_admin_title")}
      >
        <p>{t("messages.empty_admin_body")}</p>
      </Empty>
    ) : unreadOnly && filtered.length === 0 ? (
      <Empty title={t("messages.empty_unread_title")}>
        <p>{t("messages.empty_unread_body")}</p>
        <Button
          variant="secondary"
          data-size="sm"
          type="button"
          onClick={() => setUnreadOnly(false)}
        >
          {t("messages.filter_all")}
        </Button>
      </Empty>
    ) : filtered.length === 0 ? (
      <Empty title={t("messages.empty_search_title")}>
        <p>{t("messages.empty_search_body")}</p>
      </Empty>
    ) : null;

  return (
    <div
      className="admin-messages"
      data-narrow={narrow ? "true" : "false"}
      data-phone-pane={phoneThreadOpen ? "thread" : "list"}
    >
      <section
        className="admin-messages-list"
        aria-label={t("messages.list_aria")}
      >
        <div className="admin-messages-toolbar">
          <div className="admin-messages-toolbar-top">
            <h2>{t("messages.list_count", { count: rows.length })}</h2>
            <div
              className="view-switch"
              role="group"
              aria-label={t("messages.filter_aria")}
            >
              <button
                type="button"
                aria-pressed={!unreadOnly}
                onClick={() => setUnreadOnly(false)}
              >
                {t("admin.users.filter_with_count", {
                  label: t("messages.filter_all"),
                  count: rows.length,
                })}
              </button>
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(true)}
              >
                {t("admin.users.filter_with_count", {
                  label: t("messages.filter_unread"),
                  count: unreadCount,
                })}
              </button>
            </div>
          </div>
          <Field>
            <Label>{t("messages.search_label")}</Label>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("messages.search_placeholder")}
              autoComplete="off"
            />
          </Field>
        </div>
        {emptyList ? (
          emptyList
        ) : (
          <ul>
            {filtered.map((row) => {
              const name = row.customerName || t("messages.customer_fallback");
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={
                      row.id === active
                        ? "admin-messages-row active"
                        : "admin-messages-row"
                    }
                    aria-current={row.id === active ? "true" : undefined}
                    onClick={() => openRow(row.id)}
                  >
                    <span className="admin-users-avatar" aria-hidden="true">
                      {initials(name)}
                    </span>
                    <span className="admin-messages-row-body">
                      <span className="admin-messages-row-top">
                        <strong>{name}</strong>
                        <time dateTime={new Date(row.updatedAt).toISOString()}>
                          {displayDate(row.updatedAt)}{" "}
                          {shortTime(row.updatedAt)}
                        </time>
                      </span>
                      <span className="admin-messages-row-meta">
                        {row.roomName}
                      </span>
                      {row.preview ? (
                        <span className="admin-messages-row-preview">
                          {row.preview}
                        </span>
                      ) : null}
                      {row.unread > 0 ? (
                        <span className="admin-messages-row-unread">
                          {t("messages.unread", { count: row.unread })}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section
        className="admin-messages-thread"
        aria-label={t("messages.thread_aria")}
      >
        {showThread && activeRow ? (
          <>
            <header className="admin-messages-thread-header">
              {narrow ? (
                <Button
                  variant="tertiary"
                  data-size="sm"
                  type="button"
                  className="admin-messages-back"
                  onClick={() => setPhoneThreadOpen(false)}
                >
                  <ChevronLeft size={18} />
                  {t("messages.back_to_list")}
                </Button>
              ) : null}
              <h2>{activeRow.subject || t("messages.heading")}</h2>
              <p>
                {activeRow.customerName || t("messages.customer_fallback")}
                {activeRow.roomName ? ` · ${activeRow.roomName}` : ""}
              </p>
              <p className="muted">
                {displayDate(activeRow.updatedAt)}{" "}
                {shortTime(activeRow.updatedAt)}
              </p>
            </header>
            <MessageThread
              fill
              endpoint={`/admin/messages/${activeRow.id}`}
              emptyHint={t("messages.empty_thread")}
              onSent={result.reload}
            />
          </>
        ) : (
          <div className="admin-messages-thread-empty">
            <p className="muted">{t("messages.select_conversation")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
