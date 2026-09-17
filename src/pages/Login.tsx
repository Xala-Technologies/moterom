import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button, Field, Input, Label, ErrorState } from "../components/ui";
import { useApp } from "../context";
import { post } from "../api";
import { useT } from "../i18n";

type Method = "menu" | "email" | "sms";
type Step = "form" | "code" | "mfa";

/** Parked until the customer dashboard is shown again. Set to true to restore «Prøv som kunde». */
const SHOW_DEMO_CUSTOMER_LOGIN = false;

const FOOTER_LINKS = [
  { href: "https://digilist.no/personvern", labelKey: "auth.privacy" as const },
  { href: "https://digilist.no/cookies", labelKey: "auth.terms" as const },
  {
    href: "https://digilist.no/#book-demo",
    labelKey: "auth.contact_support" as const,
  },
];

function BankIdIcon({ size = 20 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="8" fill="#002776" />
      <path d="M12 14h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4v-8z" fill="white" />
      <rect x="12" y="24" width="4" height="4" fill="white" />
      <rect x="20" y="14" width="4" height="14" fill="white" />
      <path d="M28 14h-4v14h4c2.2 0 4-3.1 4-7s-1.8-7-4-7z" fill="white" />
    </svg>
  );
}

export function Login() {
  const { config, refresh } = useApp();
  const { t } = useT();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const demoMode = config?.mode === "demo";
  const digilistAuth = config?.digilistAuthConfigured === true;
  const candidate = params.get("returnTo") || "/";
  const returnTo =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
      ? candidate
      : "/";

  const [method, setMethod] = useState<Method>("menu");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState("");
  const [mfa, setMfa] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [slide, setSlide] = useState(0);
  const [panelPaused, setPanelPaused] = useState(false);

  const slides = [
    {
      headline: t("auth.slide1_headline"),
      subline: t("auth.slide1_subline"),
    },
    {
      headline: t("auth.slide2_headline"),
      subline: t("auth.slide2_subline"),
    },
    {
      headline: t("auth.slide3_headline"),
      subline: t("auth.slide3_subline"),
    },
  ];

  useEffect(() => {
    if (slides.length <= 1 || panelPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setSlide((i) => (i + 1) % slides.length),
      5500,
    );
    return () => window.clearInterval(id);
  }, [panelPaused, slides.length]);

  const done = async (destination = returnTo) => {
    const next = await refresh();
    let target = destination;
    if (destination === "/" || destination === "") {
      target = next?.isAdmin ? "/admin" : "/mine-bookinger";
    }
    nav(target, { replace: true });
  };

  const resetFlow = () => {
    setMethod("menu");
    setStep("form");
    setCode("");
    setVerification("");
    setMfa("");
    setError(undefined);
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

  const startBankId = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await post<{ url: string }>("/auth/oauth/bankid", {
        returnPath: returnTo,
      });
      window.location.href = r.url;
    } catch (e) {
      setError(e as Error);
      setBusy(false);
    }
  };

  const requestEmail = async () => {
    const r = await post<{ verificationId: string }>("/auth/request", {
      email,
    });
    setVerification(r.verificationId);
    setStep("code");
    setCode("");
  };

  const requestSms = async () => {
    const r = await post<{ verificationId: string }>("/auth/sms/request", {
      phoneNumber: phone,
    });
    setVerification(r.verificationId);
    setStep("code");
    setCode("");
  };

  const verifyEmail = async () => {
    const r = await post<{ mfaChallengeId?: string }>("/auth/verify", {
      email,
      verificationId: verification,
      code,
    });
    if (r.mfaChallengeId) {
      setMfa(r.mfaChallengeId);
      setStep("mfa");
      setCode("");
    } else await done();
  };

  const verifySms = async () => {
    const r = await post<{ mfaChallengeId?: string }>("/auth/sms/verify", {
      phoneNumber: phone,
      verificationId: verification,
      code,
    });
    if (r.mfaChallengeId) {
      setMfa(r.mfaChallengeId);
      setStep("mfa");
      setCode("");
    } else await done();
  };

  const verifyMfa = async () => {
    await post("/auth/mfa", { challengeId: mfa, code });
    await done();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (step === "mfa") await verifyMfa();
      else if (method === "email" && step === "form") await requestEmail();
      else if (method === "email" && step === "code") await verifyEmail();
      else if (method === "sms" && step === "form") await requestSms();
      else if (method === "sms" && step === "code") await verifySms();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (method === "email") await requestEmail();
      else if (method === "sms") await requestSms();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const active = slides[Math.min(slide, slides.length - 1)]!;

  return (
    <div className="login-layout">
      <div className="login-left">
        <div className="login-main">
          <div className="login-brand-wrap">
            <Link to="/" className="login-logo-link">
              <img src="/digilist-logo.svg" alt="" className="login-logo-img" />
              <span>
                <span className="login-brand-name">DIGILIST</span>
                <span className="login-brand-tagline">ENKEL BOOKING</span>
              </span>
            </Link>
          </div>

          {error && <ErrorState error={error} />}

          {method === "menu" && (
            <div className="login-options">
              {digilistAuth ? (
                <>
                  <button
                    type="button"
                    className="login-option"
                    disabled={busy}
                    onClick={() => {
                      setError(undefined);
                      setMethod("email");
                      setStep("form");
                    }}
                  >
                    <span className="login-option-icon" aria-hidden="true">
                      <Mail size={20} strokeWidth={1.75} />
                    </span>
                    <span className="login-option-copy">
                      <span className="login-option-title">
                        {t("auth.email_login_title")}
                      </span>
                      <span className="login-option-desc">
                        {t("auth.email_login_desc")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="login-option"
                    disabled={busy}
                    onClick={() => {
                      setError(undefined);
                      setMethod("sms");
                      setStep("form");
                    }}
                  >
                    <span className="login-option-icon" aria-hidden="true">
                      <Phone size={20} strokeWidth={1.75} />
                    </span>
                    <span className="login-option-copy">
                      <span className="login-option-title">
                        {t("auth.sms_login_title")}
                      </span>
                      <span className="login-option-desc">
                        {t("auth.sms_login_desc")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="login-option"
                    disabled={busy}
                    onClick={startBankId}
                  >
                    <span className="login-option-icon login-option-icon-plain">
                      <BankIdIcon size={40} />
                    </span>
                    <span className="login-option-copy">
                      <span className="login-option-title">
                        {t("auth.bankid_title")}
                      </span>
                      <span className="login-option-desc">
                        {t("auth.bankid_desc")}
                      </span>
                    </span>
                  </button>
                </>
              ) : (
                <p className="login-micro" role="status">
                  {t("auth.digilist_not_configured")}
                </p>
              )}
              {digilistAuth && (
                <p className="login-micro">{t("auth.digilist_admin_hint")}</p>
              )}

              {demoMode && (
                <>
                  {digilistAuth && (
                    <div className="login-divider" role="separator">
                      <span>{t("auth.or_divider")}</span>
                    </div>
                  )}
                  {SHOW_DEMO_CUSTOMER_LOGIN && (
                    <button
                      type="button"
                      className="login-option"
                      disabled={busy}
                      onClick={() => demo("customer")}
                    >
                      <span className="login-option-icon" aria-hidden="true">
                        <Mail size={20} strokeWidth={1.75} />
                      </span>
                      <span className="login-option-copy">
                        <span className="login-option-title">
                          {t("auth.try_as_customer")}
                        </span>
                        <span className="login-option-desc">
                          {t("auth.try_as_customer_desc")}
                        </span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="login-option"
                    disabled={busy}
                    onClick={() => demo("admin")}
                  >
                    <span className="login-option-icon" aria-hidden="true">
                      <ShieldCheck size={20} strokeWidth={1.75} />
                    </span>
                    <span className="login-option-copy">
                      <span className="login-option-title">
                        {busy
                          ? t("auth.logging_in")
                          : t("auth.log_in_as_admin")}
                      </span>
                      <span className="login-option-desc">
                        {t("auth.log_in_as_admin_desc")}
                      </span>
                    </span>
                  </button>
                  <p className="login-micro">{t("auth.demo_caption")}</p>
                </>
              )}
            </div>
          )}

          {method !== "menu" && (
            <form onSubmit={submit} className="login-form-card stack">
              {step === "form" && method === "email" && (
                <>
                  <h1 className="login-form-title">
                    {t("auth.email_login_title")}
                  </h1>
                  <p className="muted">{t("auth.email_form_subtitle")}</p>
                  <Field>
                    <Label>{t("auth.email_address")}</Label>
                    <Input
                      aria-label={t("auth.email_address")}
                      autoComplete="email"
                      type="email"
                      placeholder={t("auth.email_placeholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      required
                    />
                  </Field>
                  <Button
                    className="full-width"
                    type="submit"
                    disabled={busy || !email}
                  >
                    {busy ? t("auth.sending_code") : t("auth.continue")}
                  </Button>
                </>
              )}

              {step === "form" && method === "sms" && (
                <>
                  <h1 className="login-form-title">
                    {t("auth.sms_login_title")}
                  </h1>
                  <p className="muted">{t("auth.sms_form_subtitle")}</p>
                  <Field>
                    <Label>{t("auth.phone_number")}</Label>
                    <Input
                      aria-label={t("auth.phone_number")}
                      autoComplete="tel"
                      type="tel"
                      inputMode="tel"
                      placeholder={t("auth.phone_placeholder")}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoFocus
                      required
                    />
                  </Field>
                  <Button
                    className="full-width"
                    type="submit"
                    disabled={busy || !phone}
                  >
                    {busy ? t("auth.sending_code") : t("auth.sms_send_code")}
                  </Button>
                </>
              )}

              {step === "code" && (
                <>
                  <div className="login-step-icon" aria-hidden="true">
                    {method === "sms" ? (
                      <Phone size={24} strokeWidth={1.75} />
                    ) : (
                      <Mail size={24} strokeWidth={1.75} />
                    )}
                  </div>
                  <h1 className="login-form-title">
                    {method === "sms"
                      ? t("auth.sms_code_sent")
                      : t("auth.code_sent_title")}
                  </h1>
                  <p className="muted">
                    {method === "sms"
                      ? t("auth.sms_code_prefix")
                      : t("auth.code_verification_prefix")}{" "}
                    <strong>{method === "sms" ? phone : email}</strong>
                  </p>
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
                  <Button
                    className="full-width"
                    type="submit"
                    disabled={busy || code.length !== 6}
                  >
                    {busy ? t("auth.verifying") : t("auth.confirm_continue")}
                  </Button>
                  <div className="login-resend">
                    <p className="login-resend-title">
                      {method === "sms"
                        ? t("auth.no_sms_received")
                        : t("auth.no_code_received")}
                    </p>
                    <p className="muted">
                      {method === "sms"
                        ? t("auth.check_phone")
                        : t("auth.check_spam")}
                    </p>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={busy}
                      onClick={resend}
                    >
                      {t("auth.resend_code")}
                    </Button>
                  </div>
                </>
              )}

              {step === "mfa" && (
                <>
                  <div className="login-step-icon" aria-hidden="true">
                    <ShieldCheck size={24} strokeWidth={1.75} />
                  </div>
                  <h1 className="login-form-title">{t("auth.mfa_title")}</h1>
                  <p className="muted">{t("auth.mfa_subtitle")}</p>
                  <Field>
                    <Label>{t("auth.mfa_code_label")}</Label>
                    <Input
                      aria-label={t("auth.mfa_code_label")}
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      autoFocus
                      required
                    />
                  </Field>
                  <Button
                    className="full-width"
                    type="submit"
                    disabled={busy || !code.trim()}
                  >
                    {busy ? t("auth.verifying") : t("auth.mfa_submit")}
                  </Button>
                </>
              )}

              <Button
                variant="tertiary"
                type="button"
                className="login-back"
                onClick={resetFlow}
              >
                <ArrowLeft size={16} />
                {step === "form"
                  ? t("auth.back_to_methods")
                  : t("auth.back_to_login")}
              </Button>
            </form>
          )}
        </div>

        <div className="login-micro-footer">
          {FOOTER_LINKS.map((link, index) => (
            <span key={link.href} className="login-micro-footer-item">
              {index > 0 && (
                <span className="login-micro-footer-sep" aria-hidden>
                  ·
                </span>
              )}
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {t(link.labelKey)}
              </a>
            </span>
          ))}
        </div>
      </div>

      <aside
        className="login-right"
        aria-hidden="true"
        onMouseEnter={() => setPanelPaused(true)}
        onMouseLeave={() => setPanelPaused(false)}
      >
        <div className="login-aurora" />
        <div className="login-right-inner">
          <h2 className="login-panel-headline">{active.headline}</h2>
          <p className="login-panel-subline">{active.subline}</p>
          <p className="login-panel-micro">{t("auth.panel_micro")}</p>
          <div className="login-panel-dots" role="presentation">
            {slides.map((item, i) => (
              <button
                key={item.headline}
                type="button"
                className={
                  i === slide
                    ? "login-panel-dot login-panel-dot-active"
                    : "login-panel-dot"
                }
                aria-label={item.headline}
                onClick={() => setSlide(i)}
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
