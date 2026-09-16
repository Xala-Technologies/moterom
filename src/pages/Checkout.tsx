import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  UsersRound,
} from "lucide-react";
import { Textarea } from "@digdir/designsystemet-react";
import { useApp } from "../context";
import { api, post, useApi, ApiError } from "../api";
import {
  Button,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  validateSearch,
} from "../components/ui";
import type { Booking, Quote, Room } from "../../shared/types";
import { displayDate, money, searchParams } from "../../shared/time";
import { listingUrl } from "../../shared/urls";
import { readSearch } from "./Rooms";
export function Checkout() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user, loading, config } = useApp();
  const search = readSearch(params);
  const query = searchParams(search);
  const rooms = useApi<Room[]>("/rooms");
  const room = rooms.data?.find((r) => r.id === id);
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [revision, setRevision] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const request = useRef<{ key: string; body: unknown } | undefined>(undefined);
  const submitting = useRef(false);
  useEffect(() => {
    request.current = undefined;
  }, [id, query, user?.id]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setQuote(undefined);
    setError(undefined);
    api<Quote>("/quote", {
      method: "POST",
      body: JSON.stringify({
        ...readSearch(new URLSearchParams(query)),
        roomId: id,
      }),
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setQuote(value);
        if (request.current)
          request.current.body = {
            ...(request.current.body as Record<string, unknown>),
            quoteToken: value.token,
          };
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [id, query, user?.id, revision]);
  if (loading) return <Loading />;
  if (validateSearch(search))
    return (
      <div className="container">
        <ErrorState error={validateSearch(search)!} />
        <Link className="text-link" to="/">
          Velg et nytt tidspunkt
        </Link>
      </div>
    );
  if (!user)
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(`/bestill/${id}?${query}`)}`}
      />
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quote || !accepted || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    // An uncertain network outcome retries the exact body and key. Never generate a second attempt on retry.
    request.current ??= {
      key: crypto.randomUUID(),
      body: { ...search, roomId: id, title, notes, quoteToken: quote.token },
    };
    try {
      const booking = await post<Booking>("/bookings", request.current.body, {
        "Idempotency-Key": request.current.key,
      });
      nav(`/booking/${booking.id}?ny=1`, { replace: true });
    } catch (e) {
      setError(e as Error);
      if (e instanceof ApiError && e.code === "quote_expired") {
        setQuote(undefined);
        request.current = undefined;
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="container checkout-container">
      <Link className="back-link" to={`/rom/${id}?${query}`}>
        <ArrowLeft size={17} />
        Tilbake til rommet
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Siste steg</span>
          <h1>Se gjennom bestillingen</h1>
          <p>Kontroller rom og tidspunkt før du bekrefter.</p>
        </div>
      </div>
      <div className="checkout-layout">
        <form onSubmit={submit} className="checkout-form">
          <section className="surface-section">
            <h2>Dine opplysninger</h2>
            <div className="contact-summary">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <CheckCircle2 size={20} />
            </div>
          </section>
          <section className="surface-section stack">
            <h2>Om møtet</h2>
            <Field>
              <Label>
                Møtetittel <span className="optional">(valgfritt)</span>
              </Label>
              <Input
                aria-label="Møtetittel"
                value={title}
                maxLength={120}
                disabled={busy}
                onChange={(e) => {
                  setTitle(e.target.value);
                  request.current = undefined;
                }}
                placeholder="For eksempel teammøte"
              />
            </Field>
            <Field>
              <Label>
                Beskjed til utleier{" "}
                <span className="optional">(valgfritt)</span>
              </Label>
              <Textarea
                aria-label="Beskjed til utleier"
                value={notes}
                maxLength={1000}
                disabled={busy}
                onChange={(e) => {
                  setNotes(e.target.value);
                  request.current = undefined;
                }}
                rows={3}
              />
            </Field>
          </section>
          {error && (
            <>
              <ErrorState
                error={error}
                retry={!quote ? () => setRevision((n) => n + 1) : undefined}
              />
              {request.current && (
                <p>
                  Du kan forsøke å bekrefte samme bestilling igjen.{" "}
                  <Link className="text-link" to="/mine-bookinger">
                    Sjekk Mine bookinger
                  </Link>{" "}
                  hvis du er usikker på om den ble registrert.
                </p>
              )}
            </>
          )}{" "}
          {!quote && !error && (
            <Loading label="Kontrollerer ledighet og pris …" />
          )}
          {quote && (
            <div className="review-action">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  required
                />
                <span>Jeg har kontrollert rom, dato, tidspunkt og pris.</span>
              </label>
              {quote.paymentMode === "hosted" ? (
                <>
                  <p>
                    Betaling og endelig bekreftelse fullføres i Digilist. Dette
                    steget overfører ikke tidspunktet eller innloggingen.
                  </p>
                  {room?.slug && config?.dashboardUrl ? (
                    <a
                      className="ds-button full-width"
                      href={listingUrl(config.dashboardUrl, room.slug)}
                    >
                      Fortsett i Digilist
                    </a>
                  ) : (
                    <p className="caption">
                      Rommet mangler en publisert listing-adresse. Åpne Digilist
                      fra administrasjonen.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Button
                    className="full-width"
                    type="submit"
                    disabled={busy || !accepted}
                  >
                    {busy
                      ? "Sender bestillingen …"
                      : quote.requiresApproval
                        ? "Send forespørsel"
                        : quote.paymentMode === "invoice"
                          ? "Bestill med faktura"
                          : "Bekreft booking"}
                  </Button>
                  <p className="caption">
                    <Mail size={15} />
                    {quote.requiresApproval
                      ? "Du får beskjed når forespørselen er behandlet."
                      : "Bekreftelsen vises her og i Mine bookinger."}
                  </p>
                </>
              )}
            </div>
          )}
        </form>
        <aside className="order-summary">
          <span className="eyebrow">Din booking</span>
          <h2>{room?.name || "Møterom"}</h2>
          <dl>
            <div>
              <dt>
                <CalendarDays size={18} />
                Dato
              </dt>
              <dd>{displayDate(search.date, true)}</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={18} />
                Tid
              </dt>
              <dd>
                {search.start}–{search.end}
              </dd>
            </div>
            <div>
              <dt>
                <UsersRound size={18} />
                Deltakere
              </dt>
              <dd>{search.people} personer</dd>
            </div>
          </dl>
          <div className="summary-total">
            <span>{quote?.priceOnRequest ? "Pris" : "Totalpris"}</span>
            <strong>
              {quote ? money(quote.total, quote.currency) : "Henter pris …"}
            </strong>
          </div>
          {quote?.priceOnRequest && (
            <p className="caption">
              Prisen avklares med utleier. Dette er ikke en
              betalingsbekreftelse.
            </p>
          )}
          {quote?.paymentMode === "invoice" && (
            <p className="caption">
              Fakturering håndteres av utleier etter avtalt oppsett. Denne
              portalen oppretter ikke fakturaen selv.
            </p>
          )}
          <p className="caption">
            Endringer og avbestilling følger rommets regler i Digilist. Tillatte
            handlinger vises under Mine bookinger.
          </p>
        </aside>
      </div>
    </div>
  );
}
