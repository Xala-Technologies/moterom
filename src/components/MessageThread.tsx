import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Textarea } from "@digdir/designsystemet-react";
import { Send } from "lucide-react";
import { api, post } from "../api";
import { Button, ErrorState, Field, Label, Loading } from "./ui";
import type { ConversationThread } from "../../shared/types";
import { useFormatters, useT } from "../i18n";

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
  const { displayDate, shortTime } = useFormatters();
  const [thread, setThread] = useState<ConversationThread>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const composeId = useId();
  useEffect(() => {
    setDraft("");
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
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [thread?.messages.length]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!endpoint || busy || !draft.trim()) return;
    setBusy(true);
    setError(undefined);
    const content = draft.trim();
    try {
      const updated = await post<ConversationThread>(endpoint, {
        content,
        clientMessageId: crypto.randomUUID(),
      });
      setThread(updated);
      setDraft("");
      onSent?.();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };
  const frame = fill ? "message-thread message-thread-fill" : "message-thread";
  if (!endpoint) return null;
  if (loading)
    return (
      <div className={frame}>
        <Loading />
      </div>
    );
  const messages = thread?.messages || [];
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
          messages.map((m) => (
            <article
              key={m.id}
              className={`message-bubble ${m.fromAdmin ? "from-admin" : "from-customer"}`}
            >
              <header>
                <strong>{m.senderName}</strong>
                <time dateTime={new Date(m.createdAt).toISOString()}>
                  {displayDate(m.createdAt)} {shortTime(m.createdAt)}
                </time>
              </header>
              <p className="preserve-lines">{m.content}</p>
            </article>
          ))
        )}
      </div>
      {error && <ErrorState error={error} />}
      <form className="message-composer" onSubmit={send}>
        <Field>
          <Label htmlFor={composeId}>{t("messages.compose_label")}</Label>
          <Textarea
            id={composeId}
            rows={3}
            maxLength={4000}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy || !draft.trim()}>
          <Send size={16} />
          {busy ? t("common.sending") : t("messages.send")}
        </Button>
      </form>
    </div>
  );
}
