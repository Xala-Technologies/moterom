import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, UserRound, ArrowLeft } from "lucide-react";
import { Button, Field, Input, Label, ErrorState } from "../components/ui";
import { useApp } from "../context";
import { post } from "../api";
import { useT } from "../i18n";

/** Parked until the customer dashboard is shown again. Set to true to restore «Prøv som kunde». */
const SHOW_DEMO_CUSTOMER_LOGIN = false;

export function Login() {
  const { config, refresh } = useApp();
  const { t } = useT();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const candidate = params.get("returnTo") || "/";
  const returnTo =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
      ? candidate
      : "/";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState("");
  const [mfa, setMfa] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const done = async (destination = returnTo) => {
    await refresh();
    nav(destination, { replace: true });
  };
  const demo = async (role: "admin" | "customer") => {
    setBusy(true);
    setError(undefined);
    try {
      await post("/auth/demo", { role });
      await done(
        role === "admin"
          ? returnTo.startsWith("/admin")
            ? returnTo
            : "/admin"
          : returnTo,
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mfa) {
        await post("/auth/mfa", { challengeId: mfa, code });
        await done();
      } else if (!verification) {
        const r = await post<{ verificationId: string }>("/auth/request", {
          email,
        });
        setVerification(r.verificationId);
      } else {
        const r = await post<{ mfaChallengeId?: string }>("/auth/verify", {
          email,
          verificationId: verification,
          code,
        });
        if (r.mfaChallengeId) {
          setMfa(r.mfaChallengeId);
          setCode("");
        } else await done();
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const heading =
    config?.mode === "demo"
      ? t("auth.log_in")
      : mfa
        ? t("auth.confirm_identity")
        : verification
          ? t("auth.check_email")
          : t("auth.log_in");
  const body =
    config?.mode === "demo"
      ? SHOW_DEMO_CUSTOMER_LOGIN
        ? t("auth.demo_choose_body")
        : t("auth.demo_admin_body")
      : mfa
        ? t("auth.mfa_body")
        : verification
          ? t("auth.code_sent_body", { email })
          : t("auth.email_login_body");
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <span className="eyebrow">{t("auth.eyebrow_admin")}</span>
        <h1>{heading}</h1>
        <p className="muted">{body}</p>
        {error && <ErrorState error={error} />}
        {config?.mode === "demo" ? (
          <div className="demo-options">
            {SHOW_DEMO_CUSTOMER_LOGIN && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => demo("customer")}
              >
                <UserRound size={20} />
                {t("auth.try_as_customer")}
              </Button>
            )}
            <Button
              type="button"
              variant={SHOW_DEMO_CUSTOMER_LOGIN ? "secondary" : undefined}
              disabled={busy}
              onClick={() => demo("admin")}
            >
              <ShieldCheck size={20} />
              {busy ? t("auth.logging_in") : t("auth.log_in_as_admin")}
            </Button>
            <p className="caption">{t("auth.demo_caption")}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            {verification || mfa ? (
              <Field>
                <Label>{t("auth.one_time_code")}</Label>
                <Input
                  aria-label={t("auth.one_time_code")}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                />
              </Field>
            ) : (
              <Field>
                <Label>{t("auth.email_address")}</Label>
                <Input
                  aria-label={t("auth.email_address")}
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
            )}
            <Button className="full-width" type="submit" disabled={busy}>
              {busy
                ? t("auth.please_wait")
                : verification || mfa
                  ? t("auth.confirm_continue")
                  : t("auth.send_code")}
            </Button>
            {verification && !mfa && (
              <Button
                variant="tertiary"
                type="button"
                onClick={() => {
                  setVerification("");
                  setCode("");
                }}
              >
                <ArrowLeft size={16} />
                {t("auth.use_other_email")}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
