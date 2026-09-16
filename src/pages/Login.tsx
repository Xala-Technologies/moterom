import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, UserRound, ArrowLeft } from "lucide-react";
import { Button, Field, Input, Label, ErrorState } from "../components/ui";
import { useApp } from "../context";
import { post } from "../api";
export function Login() {
  const { config, refresh } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const candidate = params.get("returnTo") || "/mine-bookinger";
  const returnTo =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
      ? candidate
      : "/mine-bookinger";
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
        role === "admin" && !params.has("returnTo") ? "/admin" : returnTo,
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
  return (
    <div className="auth-page">
      <div className="auth-icon">
        <ShieldCheck size={28} />
      </div>
      <h1>
        {config?.mode === "demo"
          ? "Prøv møteromsportalen"
          : mfa
            ? "Bekreft identiteten din"
            : verification
              ? "Sjekk e-posten din"
              : "Velkommen tilbake"}
      </h1>
      <p className="muted">
        {config?.mode === "demo"
          ? "Velg en rolle for å utforske booking og administrasjon."
          : mfa
            ? "Skriv inn koden fra autentiseringsappen din."
            : verification
              ? `Vi har sendt en engangskode til ${email}.`
              : "Logg inn med e-post for å bestille rom og se bookingene dine."}
      </p>
      {error && <ErrorState error={error} />}
      {config?.mode === "demo" ? (
        <div className="demo-options">
          <Button disabled={busy} onClick={() => demo("customer")}>
            <UserRound size={20} />
            Prøv som kunde
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => demo("admin")}
          >
            <ShieldCheck size={20} />
            Prøv som administrator
          </Button>
          <p className="caption">Alle opplysninger i demoen er eksempler.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          {verification || mfa ? (
            <Field>
              <Label>Engangskode</Label>
              <Input
                aria-label="Engangskode"
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
              <Label>E-postadresse</Label>
              <Input
                aria-label="E-postadresse"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Vennligst vent …"
              : verification || mfa
                ? "Bekreft og fortsett"
                : "Send engangskode"}
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
              Bruk en annen e-post
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
