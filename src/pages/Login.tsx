import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail,
  Phone,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  UserRoundPlus,
} from "lucide-react";
import { Button, Field, Input, Label, ErrorState } from "../components/ui";
import {
  AccessPending,
  AccessRequestFromLogin,
} from "../components/RequireAuth";
import { AccessRequestForm } from "../components/AccessRequestForm";
import { BrandMark } from "../components/BrandMark";
import { LoginEmailField } from "../components/LoginEmailField";
import { LoginOtpBoxes } from "../components/LoginOtpBoxes";
import { useApp } from "../context";
import { ApiError, post } from "../api";
import { useT } from "../i18n";
import {
  DEFAULT_TRUST_MS,
  forgetLoginIdentity,
  isLoginIdentifierTrusted,
  readLoginEmails,
  rememberDeviceAfterLogin,
  rememberLoginEmail,
  REMEMBER_TRUST_MS,
  trustLoginIdentifier,
} from "../loginHistory";
import { postLoginPath } from "../postLoginPath";

type Method = "menu" | "email" | "sms" | "request";
type Step = "form" | "code" | "mfa";

const FOOTER_LINKS = [
  { href: "https://digilist.no/personvern", labelKey: "auth.privacy" as const },
  { href: "https://digilist.no/cookies", labelKey: "auth.terms" as const },
  {
    href: "https://digilist.no/#book-demo",
    labelKey: "auth.contact_support" as const,
  },
];

export function Login() {
  const { config, user, refresh } = useApp();
  const { t } = useT();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const digilistAuth = config?.digilistAuthConfigured === true;
  const demoMode = config?.mode === "demo";
  const returnTo = params.get("returnTo") || "/";

  const [method, setMethod] = useState<Method>("menu");
  const [step, setStep] = useState<Step>("form");
  const [emailHistory, setEmailHistory] = useState<string[]>(() =>
    typeof localStorage === "undefined" ? [] : readLoginEmails(),
  );
  const [email, setEmail] = useState(
    () =>
      (typeof localStorage === "undefined" ? [] : readLoginEmails())[0] ?? "",
  );
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState("");
  const [mfa, setMfa] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [slide, setSlide] = useState(0);
  const [panelPaused, setPanelPaused] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  /** Prevents double auto-submit when autofill fills all six digits at once. */
  const otpAutoSubmitted = useRef(false);
  const membersOnly =
    error instanceof ApiError && error.code === "members_only_access";

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
    if (next?.email) {
      // Revoked Digilist members must not keep a one-tap / trusted shortcut.
      if (config?.access === "members" && !next.isMember) {
        forgetLoginIdentity(next.email);
      } else if (config) {
        trustLoginIdentifier(
          next.email,
          "email",
          stayLoggedIn ? REMEMBER_TRUST_MS : DEFAULT_TRUST_MS,
        );
        rememberLoginEmail(next.email);
      }
      setEmailHistory(readLoginEmails());
    }
    // Do not enter the portal until members gating is known and satisfied.
    if (!config) return;
    if (config.access === "members" && next && !next.isMember) return;
    nav(postLoginPath(destination, next), { replace: true });
  };

  const resetFlow = () => {
    setMethod("menu");
    setStep("form");
    setCode("");
    setVerification("");
    setMfa("");
    setError(undefined);
  };

  const requestEmail = async (opts?: {
    forceCode?: boolean;
    forEmail?: string;
  }) => {
    const target = (opts?.forEmail ?? email).trim();
    if (!target) return;
    setEmail(target);
    rememberLoginEmail(target);
    setEmailHistory(readLoginEmails());
    // Digilist parity: trusted device skips OTP (client-enforced window).
    if (!opts?.forceCode && isLoginIdentifierTrusted(target, "email")) {
      try {
        const trusted = await post<{
          success?: boolean;
          mfaChallengeId?: string;
        }>("/auth/trusted", {
          email: target,
          rememberMe: stayLoggedIn,
        });
        if (trusted.mfaChallengeId) {
          setMfa(trusted.mfaChallengeId);
          setStep("mfa");
          setCode("");
          otpAutoSubmitted.current = false;
          return;
        }
        rememberDeviceAfterLogin({ email: target, stayLoggedIn });
        await done();
        return;
      } catch {
        // Fall through to email OTP when Digilist rejects trusted login.
      }
    }
    const r = await post<{ verificationId: string }>("/auth/request", {
      email: target,
    });
    setVerification(r.verificationId);
    setStep("code");
    setCode("");
    otpAutoSubmitted.current = false;
  };

  const continueWithRememberedEmail = (saved: string) => {
    setError(undefined);
    setMethod("email");
    setStep("form");
    setEmail(saved);
    void run(() => requestEmail({ forEmail: saved }));
  };

  const requestSms = async () => {
    const r = await post<{ verificationId: string }>("/auth/sms/request", {
      phoneNumber: phone,
    });
    setVerification(r.verificationId);
    setStep("code");
    setCode("");
    otpAutoSubmitted.current = false;
  };

  const demoSignIn = async (role: "customer" | "admin") => {
    await post("/auth/demo", { role });
    await done("/");
  };

  const verifyEmail = async (otp = code) => {
    const r = await post<{ mfaChallengeId?: string }>("/auth/verify", {
      email,
      verificationId: verification,
      code: otp,
      rememberMe: stayLoggedIn,
    });
    if (r.mfaChallengeId) {
      setMfa(r.mfaChallengeId);
      setStep("mfa");
      setCode("");
      otpAutoSubmitted.current = false;
    } else {
      rememberDeviceAfterLogin({ email, stayLoggedIn });
      await done();
    }
  };

  const verifySms = async (otp = code) => {
    const r = await post<{ mfaChallengeId?: string }>("/auth/sms/verify", {
      phoneNumber: phone,
      verificationId: verification,
      code: otp,
      rememberMe: stayLoggedIn,
    });
    if (r.mfaChallengeId) {
      setMfa(r.mfaChallengeId);
      setStep("mfa");
      setCode("");
      otpAutoSubmitted.current = false;
    } else {
      rememberDeviceAfterLogin({ phone, stayLoggedIn });
      await done();
    }
  };

  const verifyMfa = async (otp = code) => {
    await post("/auth/mfa", {
      challengeId: mfa,
      code: otp,
      rememberMe: stayLoggedIn,
    });
    rememberDeviceAfterLogin({
      email: method === "email" ? email : undefined,
      phone: method === "sms" ? phone : undefined,
      stayLoggedIn,
    });
    await done();
  };

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (err) {
      otpAutoSubmitted.current = false;
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (otp: string) => {
    if (otp.length !== 6 || otpAutoSubmitted.current) return;
    otpAutoSubmitted.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (step === "mfa") await verifyMfa(otp);
      else if (method === "email") await verifyEmail(otp);
      else if (method === "sms") await verifySms(otp);
    } catch (err) {
      otpAutoSubmitted.current = false;
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const onOtpChange = (raw: string, length = 6) => {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    setCode(digits);
    setError(undefined);
    if (digits.length < length) {
      otpAutoSubmitted.current = false;
      return;
    }
    void submitOtp(digits);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === "code" || step === "mfa") {
      const otp = code.replace(/\D/g, "").slice(0, 6);
      if (otp.length !== 6) {
        setError(new Error(t("auth.code_required")));
        return;
      }
      await submitOtp(otp);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (method === "email" && step === "form") await requestEmail();
      else if (method === "sms" && step === "form") await requestSms();
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
      if (method === "email") await requestEmail({ forceCode: true });
      else if (method === "sms") await requestSms();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };

  const active = slides[Math.min(slide, slides.length - 1)]!;

  if (user && (user.isMember || config?.access !== "members")) {
    return <Navigate replace to={postLoginPath(returnTo, user)} />;
  }
  if (user && config?.access === "members" && !user.isMember) {
    return (
      <div className="login-layout">
        <div className="login-left">
          <div className="login-main">
            <AccessPending onLogout={() => nav("/login", { replace: true })} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <div className="login-left">
        <div className="login-main">
          <div className="login-brand-wrap">
            <div className="login-logo-link" aria-hidden="true">
              <BrandMark />
            </div>
          </div>

          {membersOnly ? (
            <AccessRequestFromLogin onDismiss={() => setError(undefined)} />
          ) : (
            <>
              <p className="login-intro muted">
                {t("auth.members_gate_intro")}
              </p>
              {error && <ErrorState error={error} />}

              {method === "menu" && (
                <div className="login-options">
                  {digilistAuth && emailHistory.length > 0 ? (
                    <div
                      className="login-remembered"
                      aria-label={t("auth.email_recent")}
                    >
                      <p className="login-remembered-heading">
                        {t("auth.email_recent")}
                      </p>
                      <ul className="login-remembered-list">
                        {emailHistory.map((saved) => (
                          <li key={saved}>
                            <button
                              type="button"
                              className="login-remembered-email"
                              disabled={busy}
                              onClick={() => continueWithRememberedEmail(saved)}
                            >
                              <span
                                className="login-remembered-avatar"
                                aria-hidden="true"
                              >
                                <Mail size={16} strokeWidth={1.75} />
                              </span>
                              <span className="login-remembered-text">
                                {saved}
                              </span>
                              <ArrowRight
                                className="login-remembered-arrow"
                                size={16}
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                        onClick={() => {
                          setError(undefined);
                          setMethod("request");
                        }}
                      >
                        <span className="login-option-icon" aria-hidden="true">
                          <UserRoundPlus size={20} strokeWidth={1.75} />
                        </span>
                        <span className="login-option-copy">
                          <span className="login-option-title">
                            {t("auth.request_access_title")}
                          </span>
                          <span className="login-option-desc">
                            {t("auth.request_access_desc")}
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
                    <p className="login-micro">
                      {t("auth.digilist_admin_hint")}
                    </p>
                  )}

                  {demoMode && (
                    <>
                      {digilistAuth ? (
                        <p className="login-micro">{t("auth.or_divider")}</p>
                      ) : null}
                      <button
                        type="button"
                        className="login-option"
                        disabled={busy}
                        onClick={() => void run(() => demoSignIn("admin"))}
                      >
                        <span className="login-option-icon" aria-hidden="true">
                          <ShieldCheck size={20} strokeWidth={1.75} />
                        </span>
                        <span className="login-option-copy">
                          <span className="login-option-title">
                            {t("auth.log_in_as_admin")}
                          </span>
                          <span className="login-option-desc">
                            {t("auth.log_in_as_admin_desc")}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="login-option"
                        disabled={busy}
                        onClick={() => void run(() => demoSignIn("customer"))}
                      >
                        <span className="login-option-icon" aria-hidden="true">
                          <UserRoundPlus size={20} strokeWidth={1.75} />
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
                    </>
                  )}

                  {!digilistAuth && (
                    <button
                      type="button"
                      className="login-option"
                      disabled={busy}
                      onClick={() => {
                        setError(undefined);
                        setMethod("request");
                      }}
                    >
                      <span className="login-option-icon" aria-hidden="true">
                        <UserRoundPlus size={20} strokeWidth={1.75} />
                      </span>
                      <span className="login-option-copy">
                        <span className="login-option-title">
                          {t("auth.request_access_title")}
                        </span>
                        <span className="login-option-desc">
                          {t("auth.request_access_desc")}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              )}

              {method === "request" && (
                <AccessRequestForm showCancel onCancel={resetFlow} />
              )}

              {method !== "menu" && method !== "request" && (
                <form onSubmit={submit} className="login-form-card stack">
                  {step === "form" && method === "email" && (
                    <>
                      <h1 className="login-form-title">
                        {t("auth.email_login_title")}
                      </h1>
                      <p className="muted">{t("auth.email_form_subtitle")}</p>
                      <LoginEmailField
                        label={t("auth.email_address")}
                        placeholder={t("auth.email_placeholder")}
                        recentLabel={t("auth.email_recent")}
                        value={email}
                        suggestions={emailHistory}
                        onChange={setEmail}
                        onPick={(saved) =>
                          void run(() => requestEmail({ forEmail: saved }))
                        }
                        disabled={busy}
                      />
                      <Button
                        className="full-width login-submit"
                        type="submit"
                        disabled={busy || !email}
                      >
                        {busy ? t("auth.sending_code") : t("auth.continue")}
                        {!busy ? <ArrowRight size={18} /> : null}
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
                        className="full-width login-submit"
                        type="submit"
                        disabled={busy || !phone}
                      >
                        {busy
                          ? t("auth.sending_code")
                          : t("auth.sms_send_code")}
                        {!busy ? <ArrowRight size={18} /> : null}
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
                      <LoginOtpBoxes
                        id="login-otp-code"
                        label={t("auth.one_time_code")}
                        value={code}
                        onChange={onOtpChange}
                        disabled={busy}
                        error={Boolean(error)}
                      />
                      <label className="consent login-stay-logged-in">
                        <input
                          type="checkbox"
                          checked={stayLoggedIn}
                          onChange={(e) => setStayLoggedIn(e.target.checked)}
                        />
                        <span>{t("auth.stay_logged_in_30_days")}</span>
                      </label>
                      <Button
                        className="full-width login-submit"
                        type="submit"
                        disabled={busy || code.length !== 6}
                      >
                        {busy
                          ? t("auth.verifying")
                          : t("auth.confirm_continue")}
                        {!busy ? <ArrowRight size={18} /> : null}
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
                          className="full-width"
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
                      <h1 className="login-form-title">
                        {t("auth.mfa_title")}
                      </h1>
                      <p className="muted">{t("auth.mfa_subtitle")}</p>
                      <LoginOtpBoxes
                        id="login-otp-mfa"
                        label={t("auth.mfa_code_label")}
                        value={code}
                        onChange={onOtpChange}
                        disabled={busy}
                        error={Boolean(error)}
                      />
                      <label className="consent login-stay-logged-in">
                        <input
                          type="checkbox"
                          checked={stayLoggedIn}
                          onChange={(e) => setStayLoggedIn(e.target.checked)}
                        />
                        <span>{t("auth.stay_logged_in_30_days")}</span>
                      </label>
                      <Button
                        className="full-width login-submit"
                        type="submit"
                        disabled={busy || code.length !== 6}
                      >
                        {busy ? t("auth.verifying") : t("auth.mfa_submit")}
                        {!busy ? <ArrowRight size={18} /> : null}
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
            </>
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
