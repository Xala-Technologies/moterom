import { useState, type FormEvent } from "react";
import { Textarea } from "@digdir/designsystemet-react";
import { post } from "../../api";
import { Button, ErrorState, Field, Input, Label } from "../ui";
import type { Announcement } from "../../../shared/types";
import { useT } from "../../i18n";

export function AnnouncementForm({
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  error?: Error;
  onSubmit: (payload: { title: string; body: string }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !title.trim() || !body.trim()) return;
    await onSubmit({ title: title.trim(), body: body.trim() });
  };

  return (
    <form className="stack announcement-form" onSubmit={(e) => void send(e)}>
      <p className="muted">{t("messages.announcement_form_intro")}</p>
      <Field>
        <Label htmlFor="announcement-title">
          {t("messages.announcement_title_label")}
        </Label>
        <Input
          id="announcement-title"
          value={title}
          maxLength={120}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>
      <Field>
        <Label htmlFor="announcement-body">
          {t("messages.announcement_body_label")}
        </Label>
        <Textarea
          id="announcement-body"
          rows={5}
          maxLength={4000}
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </Field>
      {error ? <ErrorState error={error} /> : null}
      <div className="modal-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          {t("common.close")}
        </Button>
        <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
          {busy ? t("common.sending") : t("messages.announcement_publish")}
        </Button>
      </div>
    </form>
  );
}

export async function publishAnnouncement(payload: {
  title: string;
  body: string;
}): Promise<Announcement> {
  return post<Announcement>("/admin/announcements", payload);
}
