import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Label } from "./ui";
import { post } from "../api";
import { useApp } from "../context";
import { useT } from "../i18n";
import type { AccessRequest } from "../../shared/types";

type Props = {
  onDone?: () => void;
  onCancel?: () => void;
  /** After submit — return to login / log out. Defaults to onCancel. */
  onBackToLogin?: () => void;
  showCancel?: boolean;
  /** Cancel while editing the form (default: Tilbake til innlogging). */
  cancelLabel?: string;
};

/** In-app access request form. Membership is still granted in Digilist. */
export function AccessRequestForm({
  onDone,
  onCancel,
  onBackToLogin,
  showCancel = false,
  cancelLabel,
}: Props) {
  const { user, config } = useApp();
  const { t } = useT();
  const contactEmail = config?.contactEmail?.trim() || "";
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [submitted, setSubmitted] = useState(false);
  const backToLogin = onBackToLogin ?? onCancel;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await post<AccessRequest>("/access-requests", { name, email, company });
      setSubmitted(true);
      onDone?.();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="access-request-form stack" role="status">
        <h2 className="login-form-title">
          {t("auth.access_request_sent_title")}
        </h2>
        <p>{t("auth.access_request_sent_body")}</p>
        <p className="muted">{t("auth.access_request_sent_hint")}</p>
        {contactEmail ? (
          <p className="caption">
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(t("auth.access_request_subject"))}`}
            >
              {t("auth.access_request_email_fallback")}
            </a>
          </p>
        ) : null}
        {backToLogin ? (
          <Button
            variant="secondary"
            type="button"
            onClick={() => backToLogin()}
          >
            {t("auth.back_to_login")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="access-request-form stack">
      <h2 className="login-form-title">
        {t("auth.access_request_form_title")}
      </h2>
      <p className="muted">{t("auth.access_request_form_body")}</p>
      {error && <ErrorState error={error} />}
      <Field>
        <Label>{t("auth.access_request_name")}</Label>
        <Input
          aria-label={t("auth.access_request_name")}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </Field>
      <Field>
        <Label>{t("auth.email_address")}</Label>
        <Input
          aria-label={t("auth.email_address")}
          autoComplete="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
        />
      </Field>
      <Field>
        <Label>{t("auth.access_request_company")}</Label>
        <Input
          aria-label={t("auth.access_request_company")}
          autoComplete="organization"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          maxLength={120}
        />
      </Field>
      <Button
        className="full-width"
        type="submit"
        disabled={busy || !name.trim() || !email.trim() || !company.trim()}
      >
        {busy ? t("auth.access_request_sending") : t("auth.request_access")}
      </Button>
      {showCancel && onCancel ? (
        <Button variant="tertiary" type="button" onClick={onCancel}>
          {cancelLabel ?? t("auth.back_to_login")}
        </Button>
      ) : null}
    </form>
  );
}
