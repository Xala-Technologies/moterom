import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Textarea } from "@digdir/designsystemet-react";
import { Check, CheckCheck, ImagePlus, Send, X } from "lucide-react";
import { api, post } from "../api";
import { useApp } from "../context";
import { Button, ErrorState, Field, Label, Loading, Modal } from "./ui";
import type { ConversationThread, Message } from "../../shared/types";
import { useFormatters, useT } from "../i18n";
import { messageDayKey, messageInitials } from "./messageIdentity";

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ImageContentType = (typeof IMAGE_TYPES)[number];

type PendingImage = {
  filename: string;
  contentType: ImageContentType;
  data: string;
  previewUrl: string;
};

function isOwnMessage(message: Message, viewerIsAdmin: boolean): boolean {
  return viewerIsAdmin ? message.fromAdmin : !message.fromAdmin;
}

function readImageFile(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const type = file.type as ImageContentType;
    if (!IMAGE_TYPES.includes(type)) {
      reject(new Error("invalid_image_type"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("invalid_image_size"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const data = result.includes(",")
        ? result.slice(result.indexOf(",") + 1)
        : result;
      resolve({
        filename: file.name,
        contentType: type,
        data,
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function MessageThread({
  endpoint,
  emptyHint,
  onSent,
  fill = false,
}: {
  endpoint: string | null;
  emptyHint: string;
  onSent?: () => void;
  fill?: boolean;
}) {
  const { t } = useT();
  const { user } = useApp();
  const { displayDate, shortTime } = useFormatters();
  const viewerIsAdmin = Boolean(user?.isAdmin);
  const [thread, setThread] = useState<ConversationThread>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage>();
  const [previewImageUrl, setPreviewImageUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const previousEndpoint = useRef<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const composeId = useId();
  const fileId = useId();
  const canAttach = Boolean(thread?.conversation?.canAttachImages);

  const clearPendingImage = () => {
    setPendingImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return undefined;
    });
  };

  useEffect(() => {
    setDraft("");
    clearPendingImage();
    setPreviewImageUrl(undefined);
    if (!endpoint) {
      setThread(undefined);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError(undefined);
    api<ConversationThread>(endpoint, { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setThread(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e as Error);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [endpoint]);

  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const endpointChanged = previousEndpoint.current !== endpoint;
    previousEndpoint.current = endpoint;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Pin to bottom for a new thread, or when the user is already near it —
    // avoids jumping the open composer when the inbox soft-reloads.
    if (endpointChanged || distance < 96) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length, endpoint]);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl)
        URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage?.previewUrl]);

  const chooseFile = async (file: File | undefined) => {
    if (!file || !canAttach) return;
    setError(undefined);
    try {
      const next = await readImageFile(file);
      setPendingImage((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return next;
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        new Error(
          code === "invalid_image_size"
            ? t("messages.image_too_large")
            : t("messages.image_type"),
        ),
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!endpoint || busy) return;
    const content = draft.trim();
    if (!content && !pendingImage) return;
    setBusy(true);
    setError(undefined);
    try {
      const updated = await post<ConversationThread>(endpoint, {
        content,
        clientMessageId: crypto.randomUUID(),
        ...(pendingImage
          ? {
              imageFile: {
                filename: pendingImage.filename,
                contentType: pendingImage.contentType,
                data: pendingImage.data,
              },
            }
          : {}),
      });
      setThread(updated);
      setDraft("");
      clearPendingImage();
      onSent?.();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (busy || (!draft.trim() && !pendingImage)) return;
    void send();
  };

  useEffect(() => {
    if (!endpoint) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      api<ConversationThread>(endpoint)
        .then((value) => setThread(value))
        .catch(() => {
          /* keep current thread on soft refresh failure */
        });
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endpoint]);

  const frame = fill ? "message-thread message-thread-fill" : "message-thread";
  if (!endpoint) return null;
  if (loading)
    return (
      <div className={frame}>
        <Loading />
      </div>
    );
  const messages = thread?.messages || [];
  let lastDay = "";
  const canSend = Boolean(draft.trim() || pendingImage);
  return (
    <div className={frame}>
      <div
        className="message-log"
        ref={log}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="muted">{emptyHint}</p>
        ) : (
          messages.map((m) => {
            const day = messageDayKey(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const own = isOwnMessage(m, viewerIsAdmin);
            return (
              <div key={m.id} className="message-block">
                {showDay ? (
                  <div className="message-day" role="separator">
                    <span>{displayDate(m.createdAt, true)}</span>
                  </div>
                ) : null}
                <div
                  className={`message-row ${m.fromAdmin ? "from-admin" : "from-customer"}`}
                >
                  <span
                    className={`message-avatar ${m.fromAdmin ? "tone-admin" : "tone-customer"}`}
                    aria-hidden="true"
                  >
                    {messageInitials(m.senderName)}
                  </span>
                  <article
                    className={`message-bubble ${m.fromAdmin ? "from-admin" : "from-customer"}${m.imageUrl ? " has-image" : ""}`}
                  >
                    <header>
                      <strong>{m.senderName}</strong>
                    </header>
                    {m.imageUrl ? (
                      <button
                        type="button"
                        className="message-image-link"
                        onClick={() => setPreviewImageUrl(m.imageUrl)}
                        aria-label={t("messages.image_open")}
                      >
                        <img
                          className="message-image"
                          src={m.imageUrl}
                          alt={t("messages.image_alt")}
                        />
                      </button>
                    ) : null}
                    {m.content ? (
                      <p className="preserve-lines">{m.content}</p>
                    ) : null}
                    <footer className="message-meta">
                      <time dateTime={new Date(m.createdAt).toISOString()}>
                        {shortTime(m.createdAt)}
                      </time>
                      {own ? (
                        <span
                          className={`message-sent${m.readByPeer ? " is-read" : ""}`}
                          title={
                            m.readByPeer
                              ? t("messages.read")
                              : t("messages.sent")
                          }
                        >
                          {m.readByPeer ? (
                            <CheckCheck size={14} aria-hidden="true" />
                          ) : (
                            <Check size={14} aria-hidden="true" />
                          )}
                          <span className="visually-hidden">
                            {m.readByPeer
                              ? t("messages.read")
                              : t("messages.sent")}
                          </span>
                        </span>
                      ) : null}
                    </footer>
                  </article>
                </div>
              </div>
            );
          })
        )}
      </div>
      {error && <ErrorState error={error} />}
      {previewImageUrl ? (
        <Modal
          title={t("messages.image_viewer_title")}
          wide
          close={() => setPreviewImageUrl(undefined)}
        >
          <div className="message-image-viewer">
            <img
              src={previewImageUrl}
              alt={t("messages.image_alt")}
              className="message-image-viewer-img"
            />
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewImageUrl(undefined)}
            >
              {t("common.close")}
            </Button>
          </div>
        </Modal>
      ) : null}
      <form className="message-composer" onSubmit={send}>
        {pendingImage ? (
          <div className="message-attach-preview">
            <img
              src={pendingImage.previewUrl}
              alt={t("messages.image_preview_alt")}
            />
            <span className="visually-hidden">{pendingImage.filename}</span>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              className="message-attach-remove"
              disabled={busy}
              onClick={clearPendingImage}
              aria-label={t("messages.image_remove")}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        <div className="message-composer-main">
          <Field>
            <span className="visually-hidden">
              <Label htmlFor={composeId}>{t("messages.compose_label")}</Label>
            </span>
            <div
              className={
                canAttach
                  ? "message-composer-input has-attach"
                  : "message-composer-input"
              }
            >
              <Textarea
                id={composeId}
                rows={1}
                maxLength={4000}
                value={draft}
                disabled={busy}
                placeholder={
                  viewerIsAdmin
                    ? t("messages.compose_placeholder_admin")
                    : t("messages.compose_placeholder_customer")
                }
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
              />
              {canAttach ? (
                <>
                  <input
                    ref={fileRef}
                    id={fileId}
                    className="message-attach-input"
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    disabled={busy}
                    onChange={(e) => void chooseFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    className="message-attach-button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    aria-label={t("messages.attach_image")}
                    title={t("messages.attach_image")}
                  >
                    <ImagePlus size={18} aria-hidden="true" />
                  </Button>
                </>
              ) : null}
              <Button
                type="submit"
                variant="tertiary"
                data-size="sm"
                className="message-send-button"
                disabled={busy || !canSend}
                aria-busy={busy || undefined}
                aria-label={busy ? t("common.sending") : t("messages.send")}
                title={busy ? t("common.sending") : t("messages.send")}
              >
                <Send size={18} aria-hidden="true" />
              </Button>
            </div>
          </Field>
        </div>
      </form>
    </div>
  );
}
