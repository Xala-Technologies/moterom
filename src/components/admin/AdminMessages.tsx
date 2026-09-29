import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Mail,
  MailOpen,
  MessageCircle,
  Search,
  Trash2,
} from "lucide-react";
import { api, post, useApi } from "../../api";
import { useApp } from "../../context";
import { Button, Empty, ErrorState, Input, Loading, Modal } from "../ui";
import { MessageThread } from "../MessageThread";
import { MessageContextCard } from "../MessageContextCard";
import { messageInitials } from "../messageIdentity";
import { AnnouncementForm, publishAnnouncement } from "./AnnouncementForm";
import { findConversation } from "../../customerMessageInbox";
import type { Booking, ConversationSummary } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";

function rowMeta(row: ConversationSummary, supportLabel: string): string {
  if (row.kind === "support") return supportLabel;
  return row.roomName || row.subject;
}

function matchesQuery(row: ConversationSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.customerName, row.roomName, row.subject, row.preview, row.kind]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function adminThreadEndpoint(row: ConversationSummary): string {
  if (row.kind === "booking" && row.bookingId) {
    return `/bookings/${encodeURIComponent(row.bookingId)}/messages`;
  }
  return `/admin/messages/${encodeURIComponent(row.id)}`;
}

function bookingFocusRow(
  booking: Booking,
  emptyPreview: string,
): ConversationSummary {
  return {
    id: `booking:${booking.id}`,
    kind: "booking",
    bookingId: booking.id,
    roomId: booking.roomId,
    roomName: booking.roomName,
    subject: booking.roomName,
    preview: emptyPreview,
    updatedAt: booking.startTime,
    unread: 0,
    customerName: booking.name,
    canAttachImages: true,
    context: {
      roomId: booking.roomId,
      roomName: booking.roomName,
      bookingId: booking.id,
      reference: booking.reference,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    },
  };
}

export function AdminMessages({
  announceOpen,
  onAnnounceOpenChange,
}: {
  announceOpen: boolean;
  onAnnounceOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const { notify, config } = useApp();
  const { displayDate, shortTime } = useFormatters();
  const [params, setParams] = useSearchParams();
  const bookingFocusId = params.get("booking")?.trim() || undefined;
  const result = useApi<ConversationSummary[]>("/admin/messages");
  const focusBooking = useApi<Booking>(
    bookingFocusId ? `/bookings/${encodeURIComponent(bookingFocusId)}` : null,
  );
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [phoneThreadOpen, setPhoneThreadOpen] = useState(false);
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceError, setAnnounceError] = useState<Error>();
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [readBusyId, setReadBusyId] = useState<string>();
  const announceWasOpen = useRef(false);
  const appliedBookingFocus = useRef<string | undefined>(undefined);
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const emptyPreview = t("messages.list_empty_preview");
  const [pinnedBooking, setPinnedBooking] = useState<ConversationSummary>();

  useEffect(() => {
    if (announceOpen && !announceWasOpen.current) setAnnounceError(undefined);
    announceWasOpen.current = announceOpen;
  }, [announceOpen]);

  useEffect(() => {
    return () => onAnnounceOpenChange(false);
  }, [onAnnounceOpenChange]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const inboxRows = result.data || [];
  useEffect(() => {
    if (!pinnedBooking?.bookingId) return;
    if (findConversation(inboxRows, pinnedBooking.bookingId)) {
      setPinnedBooking(undefined);
    }
  }, [inboxRows, pinnedBooking]);

  const rows =
    pinnedBooking &&
    pinnedBooking.bookingId &&
    !findConversation(inboxRows, pinnedBooking.bookingId)
      ? [pinnedBooking, ...inboxRows]
      : inboxRows;

  useEffect(() => {
    if (!result.data) return;
    if (bookingFocusId) return;
    const list =
      pinnedBooking &&
      pinnedBooking.bookingId &&
      !findConversation(result.data, pinnedBooking.bookingId)
        ? [pinnedBooking, ...result.data]
        : result.data;
    setSelected((current) => {
      if (current && findConversation(list, current)) return current;
      if (narrow) return undefined;
      const first = list.find((row) => {
        if (unreadOnly && row.unread <= 0) return false;
        return matchesQuery(row, query);
      });
      return first?.id;
    });
  }, [bookingFocusId, narrow, pinnedBooking, query, result.data, unreadOnly]);

  useEffect(() => {
    if (!bookingFocusId || !result.data) return;
    if (appliedBookingFocus.current === bookingFocusId) return;
    const existing = findConversation(inboxRows, bookingFocusId);
    if (existing) {
      appliedBookingFocus.current = bookingFocusId;
      setSelected(existing.id);
      setPhoneThreadOpen(true);
      setUnreadOnly(false);
      setPinnedBooking(undefined);
      const next = new URLSearchParams(params);
      next.delete("booking");
      setParams(next, { replace: true });
      return;
    }
    if (focusBooking.loading) return;
    if (focusBooking.error || !focusBooking.data) {
      if (focusBooking.error) notify(focusBooking.error.message);
      appliedBookingFocus.current = bookingFocusId;
      const next = new URLSearchParams(params);
      next.delete("booking");
      setParams(next, { replace: true });
      return;
    }
    const stub = bookingFocusRow(focusBooking.data, emptyPreview);
    appliedBookingFocus.current = bookingFocusId;
    setPinnedBooking(stub);
    setSelected(stub.id);
    setPhoneThreadOpen(true);
    setUnreadOnly(false);
    const next = new URLSearchParams(params);
    next.delete("booking");
    setParams(next, { replace: true });
  }, [
    bookingFocusId,
    emptyPreview,
    focusBooking.data,
    focusBooking.error,
    focusBooking.loading,
    inboxRows,
    notify,
    params,
    result.data,
    setParams,
  ]);

  if (result.loading && !result.data) return <Loading />;
  if (result.error && !result.data)
    return <ErrorState error={result.error} retry={result.reload} />;
  if (
    bookingFocusId &&
    focusBooking.loading &&
    !findConversation(inboxRows, bookingFocusId) &&
    !pinnedBooking
  )
    return <Loading />;

  const unreadCount = rows.filter((row) => row.unread > 0).length;
  const filtered = rows.filter((row) => {
    if (unreadOnly && row.unread <= 0) return false;
    return matchesQuery(row, query);
  });
  const selectedKnown = findConversation(rows, selected)?.id;
  const active = selectedKnown
    ? narrow
      ? phoneThreadOpen
        ? selectedKnown
        : undefined
      : selectedKnown
    : narrow
      ? undefined
      : filtered[0]?.id;
  const activeRow = findConversation(rows, active);
  const showThread = Boolean(active) && (!narrow || phoneThreadOpen);
  const supportLabel = t("messages.kind_support");
  const canDeleteActive = Boolean(
    activeRow && !String(activeRow.id).startsWith("booking:"),
  );

  const openRow = (id: string) => {
    setSelected(id);
    if (narrow) setPhoneThreadOpen(true);
    result.setData((current) =>
      (current || []).map((item) =>
        item.id === id && item.unread > 0 ? { ...item, unread: 0 } : item,
      ),
    );
  };

  const setReadState = async (row: ConversationSummary, unread: boolean) => {
    if (readBusyId) return;
    setReadBusyId(row.id);
    try {
      const next = await post<{ success: true; unread: number }>(
        `/admin/messages/${row.id}/read-state`,
        { unread },
      );
      result.setData((current) =>
        (current || []).map((item) =>
          item.id === row.id ? { ...item, unread: next.unread } : item,
        ),
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setReadBusyId(undefined);
    }
  };

  const deleteConversation = async (row: ConversationSummary) => {
    setDeleteBusy(true);
    try {
      await api<{ success: true }>(`/admin/messages/${row.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(undefined);
      setSelected(undefined);
      setPhoneThreadOpen(false);
      result.reload();
      notify(t("messages.deleted"));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setDeleteBusy(false);
    }
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
    <>
      <div
        className="messages-desk admin-messages"
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
              <div className="admin-messages-toolbar-actions">
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
            </div>
            <div className="admin-list-search">
              <Search size={18} aria-hidden="true" />
              <Input
                type="search"
                aria-label={t("messages.search_label")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("messages.search_placeholder")}
                autoComplete="off"
              />
            </div>
          </div>
          {emptyList ? (
            emptyList
          ) : (
            <ul>
              {filtered.map((row) => {
                const name =
                  row.customerName || t("messages.customer_fallback");
                const isUnread = row.unread > 0;
                return (
                  <li key={row.id}>
                    <div
                      className={
                        row.id === active
                          ? "admin-messages-row active"
                          : "admin-messages-row"
                      }
                      data-unread={isUnread ? "true" : undefined}
                    >
                      <button
                        type="button"
                        className="admin-messages-row-main"
                        aria-current={row.id === active ? "true" : undefined}
                        onClick={() => openRow(row.id)}
                      >
                        <span className="admin-users-avatar" aria-hidden="true">
                          {messageInitials(name)}
                        </span>
                        <span className="admin-messages-row-body">
                          <span className="admin-messages-row-top">
                            <strong>{name}</strong>
                            <time
                              dateTime={new Date(row.updatedAt).toISOString()}
                            >
                              {displayDate(row.updatedAt)}{" "}
                              {shortTime(row.updatedAt)}
                            </time>
                          </span>
                          <span className="admin-messages-row-meta">
                            {rowMeta(row, supportLabel)}
                          </span>
                          {row.preview ? (
                            <span className="admin-messages-row-preview">
                              {row.preview}
                            </span>
                          ) : null}
                          {isUnread ? (
                            <span className="admin-messages-row-unread">
                              {t("messages.unread", { count: row.unread })}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {String(row.id).startsWith("booking:") ? null : (
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          className="messages-desk-read-toggle"
                          disabled={readBusyId === row.id}
                          aria-label={
                            isUnread
                              ? t("messages.mark_read")
                              : t("messages.mark_unread")
                          }
                          title={
                            isUnread
                              ? t("messages.mark_read")
                              : t("messages.mark_unread")
                          }
                          onClick={() => void setReadState(row, !isUnread)}
                        >
                          {isUnread ? (
                            <MailOpen size={16} aria-hidden="true" />
                          ) : (
                            <Mail size={16} aria-hidden="true" />
                          )}
                        </Button>
                      )}
                    </div>
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
              <header className="messages-desk-thread-header admin-messages-thread-header">
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
                <div className="admin-messages-thread-heading">
                  <div>
                    <h2>
                      {activeRow.customerName ||
                        t("messages.customer_fallback")}
                    </h2>
                    <p className="muted">
                      {displayDate(activeRow.updatedAt)}{" "}
                      {shortTime(activeRow.updatedAt)}
                    </p>
                  </div>
                  {canDeleteActive ? (
                    <Button
                      type="button"
                      variant="secondary"
                      data-size="sm"
                      data-color="danger"
                      onClick={() => setDeleteTarget(activeRow)}
                    >
                      <Trash2 size={16} />
                      {t("messages.delete")}
                    </Button>
                  ) : null}
                </div>
                <MessageContextCard conversation={activeRow} admin />
              </header>
              <MessageThread
                fill
                endpoint={adminThreadEndpoint(activeRow)}
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
      {announceOpen ? (
        <Modal
          title={t("messages.announcement_new")}
          close={() => {
            if (!announceBusy) onAnnounceOpenChange(false);
          }}
        >
          <AnnouncementForm
            busy={announceBusy}
            error={announceError}
            onCancel={() => {
              if (!announceBusy) onAnnounceOpenChange(false);
            }}
            onSubmit={async (payload) => {
              setAnnounceBusy(true);
              setAnnounceError(undefined);
              try {
                await publishAnnouncement(payload);
                onAnnounceOpenChange(false);
                notify(t("messages.announcement_published"));
              } catch (err) {
                setAnnounceError(err as Error);
              } finally {
                setAnnounceBusy(false);
              }
            }}
          />
        </Modal>
      ) : null}
      {deleteTarget ? (
        <Modal
          title={t("messages.delete_title")}
          close={() => {
            if (!deleteBusy) setDeleteTarget(undefined);
          }}
        >
          <p>
            {t(
              deleteTarget.kind === "support"
                ? "messages.delete_body_support"
                : config?.mode === "live"
                  ? "messages.delete_body_booking_live"
                  : "messages.delete_body_booking",
              {
                name:
                  deleteTarget.customerName || t("messages.customer_fallback"),
              },
            )}
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              disabled={deleteBusy}
              onClick={() => setDeleteTarget(undefined)}
            >
              {t("messages.delete_cancel")}
            </Button>
            <Button
              type="button"
              data-color="danger"
              disabled={deleteBusy}
              onClick={() => void deleteConversation(deleteTarget)}
            >
              {t("messages.delete_confirm")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
