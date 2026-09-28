import { Navigate } from "react-router-dom";
import { Textarea } from "@digdir/designsystemet-react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  MessageCircle,
  Search,
} from "lucide-react";
import { useApp } from "../context";
import { post, useApi } from "../api";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Modal,
  Select,
} from "../components/ui";
import { MessageThread } from "../components/MessageThread";
import { MessageContextCard } from "../components/MessageContextCard";
import { messageInitials } from "../components/messageIdentity";
import type {
  Booking,
  ConversationSummary,
  ConversationThread,
} from "../../shared/types";
import { compareAgenda, isOpenBooking } from "../../shared/bookingOrder";
import {
  conversationSelectionKey,
  filterCustomerMessageInbox,
  findConversation,
  mergeCustomerMessageInbox,
  threadEndpoint,
  type MessageReadFilter,
} from "../customerMessageInbox";
import { useFormatters, useT } from "../i18n";
import { useEffect, useId, useState, type FormEvent } from "react";

const SUPPORT_TOPIC = "support";
const PAGE_SIZE = 10;

export function Messages() {
  const { user, loading, notify } = useApp();
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const customer = Boolean(user && !user.isAdmin);
  const result = useApi<ConversationSummary[]>(user ? "/messages" : null);
  const bookingsResult = useApi<{ bookings: Booking[] }>(
    customer ? "/bookings" : null,
  );
  const [selected, setSelected] = useState<string>();
  const [listPage, setListPage] = useState(0);
  const [query, setQuery] = useState("");
  const [readFilter, setReadFilter] = useState<MessageReadFilter>("all");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTopic, setContactTopic] = useState(SUPPORT_TOPIC);
  const [contactDraft, setContactDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<Error>();
  const [phoneThreadOpen, setPhoneThreadOpen] = useState(false);
  const contactFieldId = useId();
  const topicFieldId = useId();
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const emptyPreview = t("messages.list_empty_preview");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const inboxRows = mergeCustomerMessageInbox(
    result.data || [],
    bookingsResult.data?.bookings || [],
    emptyPreview,
  );
  const filteredRows = filterCustomerMessageInbox(inboxRows, {
    query,
    read: readFilter,
    kind: "all",
  });
  const filtersActive = query.trim().length > 0 || readFilter !== "all";
  const unreadCount = inboxRows.filter((row) => row.unread > 0).length;
  const readCount = inboxRows.length - unreadCount;
  const listKey = filteredRows.map((row) => row.id).join(",");
  const filterKey = `${readFilter}|${query.trim().toLowerCase()}`;

  useEffect(() => {
    if (!result.data && !bookingsResult.data) return;
    const merged = mergeCustomerMessageInbox(
      result.data || [],
      bookingsResult.data?.bookings || [],
      emptyPreview,
    );
    const filtered = filterCustomerMessageInbox(merged, {
      query,
      read: readFilter,
      kind: "all",
    });
    setSelected((current) => {
      if (current && findConversation(filtered, current)) return current;
      if (narrow) return undefined;
      return filtered[0] ? conversationSelectionKey(filtered[0]) : undefined;
    });
  }, [
    narrow,
    result.data,
    bookingsResult.data,
    emptyPreview,
    query,
    readFilter,
  ]);

  useEffect(() => {
    setListPage(0);
  }, [filterKey]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    if (listPage > pageCount - 1) setListPage(Math.max(0, pageCount - 1));
  }, [filteredRows.length, listPage]);

  useEffect(() => {
    if (!selected) return;
    const index = filteredRows.findIndex(
      (row) => conversationSelectionKey(row) === selected,
    );
    if (index < 0) return;
    const pageForSelected = Math.floor(index / PAGE_SIZE);
    setListPage((current) =>
      current === pageForSelected ? current : pageForSelected,
    );
  }, [selected, listKey]);

  const clearFilters = () => {
    setQuery("");
    setReadFilter("all");
  };

  const openContact = () => {
    setStartError(undefined);
    setContactDraft("");
    setContactTopic(SUPPORT_TOPIC);
    setContactOpen(true);
  };

  const closeContact = () => {
    if (starting) return;
    setContactOpen(false);
    setStartError(undefined);
  };

  const openRow = (row: ConversationSummary) => {
    setSelected(conversationSelectionKey(row));
    if (narrow) setPhoneThreadOpen(true);
  };

  const upsertInbox = (conversation: ConversationSummary) => {
    result.setData((current) => {
      const rows = current || [];
      return [
        conversation,
        ...rows.filter((row) => row.id !== conversation.id),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const sendSupport = async (event: FormEvent) => {
    event.preventDefault();
    const content = contactDraft.trim();
    const topic = contactTopic;
    if (starting || !content) return;
    setStarting(true);
    setStartError(undefined);
    try {
      const clientMessageId = crypto.randomUUID();
      const thread =
        topic === SUPPORT_TOPIC
          ? await post<ConversationThread>("/messages/support", {
              content,
              clientMessageId,
            })
          : await post<ConversationThread>(
              `/bookings/${encodeURIComponent(topic)}/messages`,
              { content, clientMessageId },
            );
      setContactOpen(false);
      setContactDraft("");
      setContactTopic(SUPPORT_TOPIC);
      if (thread.conversation) {
        upsertInbox(thread.conversation);
        openRow(thread.conversation);
      }
      result.reload();
      notify(
        topic === SUPPORT_TOPIC
          ? t("messages.support_sent")
          : t("messages.booking_message_sent"),
      );
    } catch (err) {
      setStartError(err as Error);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <Loading />;
  if (!user) return <Navigate replace to="/login?returnTo=/meldinger" />;
  if (user.isAdmin) return <Navigate replace to="/admin/messages" />;

  const rows = filteredRows;
  const paginate = rows.length > PAGE_SIZE;
  const pageCount = paginate ? Math.ceil(rows.length / PAGE_SIZE) : 1;
  const safePage = Math.min(listPage, pageCount - 1);
  const pageStart = paginate ? safePage * PAGE_SIZE : 0;
  const pageEnd = paginate ? pageStart + PAGE_SIZE : rows.length;
  const visibleRows = rows.slice(pageStart, pageEnd);
  const pageFrom = rows.length === 0 ? 0 : pageStart + 1;
  const pageTo = Math.min(pageEnd, rows.length);
  const activeRow = findConversation(inboxRows, selected);
  const active = activeRow ? conversationSelectionKey(activeRow) : undefined;
  const showThreadPane = Boolean(activeRow) && (!narrow || phoneThreadOpen);

  const listLabel = (row: ConversationSummary) =>
    row.kind === "support"
      ? t("messages.kind_support")
      : row.subject || row.roomName;

  const bookingOptions = [...(bookingsResult.data?.bookings || [])]
    .sort(compareAgenda)
    .slice(0, 40);
  const topicIsSupport = contactTopic === SUPPORT_TOPIC;
  const selectedBooking = topicIsSupport
    ? undefined
    : bookingOptions.find((booking) => booking.id === contactTopic);
  const listLoading =
    (result.loading && !result.data) ||
    (bookingsResult.loading && !bookingsResult.data);

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
            onClick={openContact}
          >
            <LifeBuoy size={16} aria-hidden="true" />
            {t("messages.contact_us")}
          </Button>
        </div>
      </header>

      {contactOpen ? (
        <Modal title={t("messages.contact_title")} close={closeContact}>
          <form
            className="stack support-contact-form"
            onSubmit={(event) => void sendSupport(event)}
          >
            <p className="support-contact-kind">
              {topicIsSupport ? (
                <LifeBuoy size={16} aria-hidden="true" />
              ) : (
                <CalendarDays size={16} aria-hidden="true" />
              )}
              {topicIsSupport
                ? t("messages.kind_support")
                : selectedBooking?.roomName || t("messages.kind_booking")}
            </p>
            <p className="muted">{t("messages.contact_intro")}</p>
            <Field>
              <Label htmlFor={topicFieldId}>
                {t("messages.contact_topic_label")}
              </Label>
              <Select
                id={topicFieldId}
                value={contactTopic}
                disabled={starting || bookingsResult.loading}
                onChange={(e) => setContactTopic(e.target.value)}
              >
                <Select.Option value={SUPPORT_TOPIC}>
                  {t("messages.contact_topic_support")}
                </Select.Option>
                {bookingOptions.map((booking) => {
                  const label = t("messages.contact_topic_booking", {
                    room: booking.roomName,
                    date: displayDate(booking.startTime, true),
                    time: `${shortTime(booking.startTime)}–${shortTime(booking.endTime)}`,
                    reference: booking.reference,
                  });
                  return (
                    <Select.Option key={booking.id} value={booking.id}>
                      {isOpenBooking(booking)
                        ? label
                        : `${label} (${t("messages.contact_topic_past")})`}
                    </Select.Option>
                  );
                })}
              </Select>
            </Field>
            <Field>
              <Label htmlFor={contactFieldId}>
                {t("messages.contact_message_label")}
              </Label>
              <Textarea
                id={contactFieldId}
                rows={5}
                maxLength={4000}
                value={contactDraft}
                disabled={starting}
                onChange={(e) => setContactDraft(e.target.value)}
                required
              />
            </Field>
            {startError ? <ErrorState error={startError} /> : null}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={starting}
                onClick={closeContact}
              >
                {t("common.close")}
              </Button>
              <Button type="submit" disabled={starting || !contactDraft.trim()}>
                {topicIsSupport ? (
                  <LifeBuoy size={16} aria-hidden="true" />
                ) : (
                  <MessageCircle size={16} aria-hidden="true" />
                )}
                {starting ? t("common.sending") : t("messages.contact_send")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {listLoading ? (
        <Loading />
      ) : result.error && !result.data ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : inboxRows.length === 0 ? (
        <Empty
          icon={<MessageCircle size={36} />}
          title={t("messages.empty_title")}
        >
          <p>{t("messages.empty_body")}</p>
          <Button type="button" disabled={starting} onClick={openContact}>
            <LifeBuoy size={16} aria-hidden="true" />
            {t("messages.contact_us")}
          </Button>
        </Empty>
      ) : (
        <div
          className="messages-desk customer-messages"
          data-narrow={narrow ? "true" : "false"}
          data-phone-pane={phoneThreadOpen ? "thread" : "list"}
        >
          <section
            className="customer-messages-list"
            aria-label={t("messages.list_aria")}
          >
            <div className="customer-messages-toolbar">
              <div className="customer-messages-toolbar-top">
                <h2>
                  {t("messages.list_count", {
                    count: filtersActive ? rows.length : inboxRows.length,
                  })}
                </h2>
              </div>
              <div
                className="view-switch"
                role="group"
                aria-label={t("messages.filter_aria")}
              >
                <button
                  type="button"
                  aria-pressed={readFilter === "all"}
                  onClick={() => setReadFilter("all")}
                >
                  {t("admin.users.filter_with_count", {
                    label: t("messages.filter_all"),
                    count: inboxRows.length,
                  })}
                </button>
                <button
                  type="button"
                  aria-pressed={readFilter === "unread"}
                  onClick={() => setReadFilter("unread")}
                >
                  {t("admin.users.filter_with_count", {
                    label: t("messages.filter_unread"),
                    count: unreadCount,
                  })}
                </button>
                <button
                  type="button"
                  aria-pressed={readFilter === "read"}
                  onClick={() => setReadFilter("read")}
                >
                  {t("admin.users.filter_with_count", {
                    label: t("messages.filter_read"),
                    count: readCount,
                  })}
                </button>
              </div>
              <div className="admin-list-search">
                <Search size={18} aria-hidden="true" />
                <Input
                  type="search"
                  aria-label={t("messages.search_label")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("messages.search_placeholder_customer")}
                  autoComplete="off"
                />
              </div>
            </div>
            {rows.length === 0 ? (
              <Empty
                title={
                  readFilter === "unread"
                    ? t("messages.empty_unread_title")
                    : readFilter === "read"
                      ? t("messages.empty_read_title")
                      : t("messages.empty_search_title")
                }
              >
                <p>
                  {readFilter === "unread"
                    ? t("messages.empty_unread_customer_body")
                    : readFilter === "read"
                      ? t("messages.empty_read_body")
                      : t("messages.empty_search_body")}
                </p>
                {filtersActive ? (
                  <Button
                    variant="secondary"
                    data-size="sm"
                    type="button"
                    onClick={clearFilters}
                  >
                    {t("common.reset_filters")}
                  </Button>
                ) : null}
              </Empty>
            ) : (
              <>
                <ul>
                  {visibleRows.map((row) => {
                    const label = listLabel(row);
                    const key = conversationSelectionKey(row);
                    const isActive = key === active;
                    const isUnread = row.unread > 0;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={
                            isActive
                              ? "customer-messages-row active"
                              : "customer-messages-row"
                          }
                          data-unread={isUnread ? "true" : undefined}
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => openRow(row)}
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
                            {isUnread ? (
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
                {paginate ? (
                  <nav
                    className="customer-messages-list-pagination"
                    aria-label={t("messages.list_pagination_aria")}
                  >
                    <p
                      className="customer-messages-list-pagination-status"
                      aria-live="polite"
                    >
                      {t("messages.list_page_status", {
                        from: pageFrom,
                        to: pageTo,
                        total: rows.length,
                      })}
                    </p>
                    <div className="customer-messages-list-pagination-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        data-size="sm"
                        disabled={safePage <= 0}
                        aria-label={t("messages.list_previous")}
                        onClick={() =>
                          setListPage((current) => Math.max(0, current - 1))
                        }
                      >
                        <ChevronLeft size={16} aria-hidden="true" />
                        {t("messages.list_previous")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        data-size="sm"
                        disabled={safePage >= pageCount - 1}
                        aria-label={t("messages.list_next")}
                        onClick={() =>
                          setListPage((current) =>
                            Math.min(pageCount - 1, current + 1),
                          )
                        }
                      >
                        {t("messages.list_next")}
                        <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </nav>
                ) : null}
              </>
            )}
          </section>

          <section
            className="customer-messages-thread"
            aria-label={t("messages.thread_aria")}
          >
            {showThreadPane && activeRow ? (
              <>
                <header className="messages-desk-thread-header customer-messages-thread-header">
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
                  endpoint={threadEndpoint(activeRow)}
                  emptyHint={t("messages.empty_thread")}
                  onSent={() => {
                    result.reload();
                  }}
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
