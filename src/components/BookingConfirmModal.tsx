import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, post, ApiError } from "../api";
import { useApp } from "../context";
import type {
  Booking,
  Organization,
  OrganizationMembership,
  Quote,
  Room,
} from "../../shared/types";
import { useFormatters, useT } from "../i18n";
import {
  Button,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Modal,
  Select,
  Status,
} from "./ui";
import type { RoomSlotSelection } from "./RoomCardSchedule";

type MyOrgRow = {
  membership: OrganizationMembership;
  organization: Organization;
};

export function BookingConfirmModal({
  room,
  selection,
  purpose,
  onPurposeChange,
  close,
  onSuccess,
}: {
  room: Room;
  selection: RoomSlotSelection;
  purpose: string;
  onPurposeChange: (value: string) => void;
  close: () => void;
  onSuccess: () => void;
}) {
  const { user, refresh, config } = useApp();
  const { t } = useT();
  const { displayDate, money } = useFormatters();
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking>();
  const [revision, setRevision] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [myOrgs, setMyOrgs] = useState<MyOrgRow[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [orgHits, setOrgHits] = useState<
    Array<{ organizationNumber: string; name: string }>
  >([]);
  const [orgBusy, setOrgBusy] = useState(false);
  const request = useRef<{ key: string; body: unknown } | undefined>(undefined);
  const submitting = useRef(false);
  const search = {
    date: selection.date,
    start: selection.start,
    end: selection.end,
    people: 1,
  };
  const needsLogin = !user;
  const cancelDays =
    room.cancelDeadlineDays ?? (room.requiresApproval ? 30 : 5);
  const returnTo = `/?rom=${encodeURIComponent(room.id)}`;
  const demoOrgs = config?.mode === "demo";

  useEffect(() => {
    request.current = undefined;
    setAcceptedTerms(false);
  }, [room.id, selection.date, selection.start, selection.end, user?.id]);

  useEffect(() => {
    if (needsLogin || !demoOrgs || booking) return;
    const controller = new AbortController();
    api<MyOrgRow[]>("/me/organizations", { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setMyOrgs(rows);
        setOrganizationId((prev) => {
          if (prev && rows.some((r) => r.organization.id === prev)) return prev;
          return rows[0]?.organization.id || "";
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMyOrgs([]);
      });
    return () => controller.abort();
  }, [needsLogin, demoOrgs, booking, user?.id, revision]);

  useEffect(() => {
    if (needsLogin || booking) return;
    const controller = new AbortController();
    setQuote(undefined);
    setError(undefined);
    api<Quote>("/quote", {
      method: "POST",
      body: JSON.stringify({
        ...search,
        roomId: room.id,
        ...(organizationId ? { organizationId } : {}),
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
            ...(organizationId ? { organizationId } : {}),
          };
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [
    needsLogin,
    booking,
    room.id,
    selection.date,
    selection.start,
    selection.end,
    user?.id,
    revision,
    organizationId,
  ]);

  const confirmLabel = quote?.requiresApproval
    ? t("booking.submit_request")
    : quote?.paymentMode === "invoice"
      ? t("booking.submit_invoice")
      : t("booking.submit_confirm");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsLogin || !quote || submitting.current) return;
    if (!acceptedTerms) {
      setError(new Error(t("booking.terms_required")));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    request.current ??= {
      key: crypto.randomUUID(),
      body: {
        ...search,
        roomId: room.id,
        title: purpose,
        notes: "",
        name: (user?.name || "").trim(),
        email: (user?.email || "").trim(),
        phone: "",
        quoteToken: quote.token,
        acceptedTerms: true as const,
        ...(organizationId ? { organizationId } : {}),
      },
    };
    try {
      const created = await post<Booking>("/bookings", request.current.body, {
        "Idempotency-Key": request.current.key,
      });
      // Show the in-modal confirmation before any parent refresh work.
      setBooking(created);
      onSuccess();
      await refresh();
    } catch (err) {
      setError(err as Error);
      if (err instanceof ApiError && err.code === "quote_expired") {
        setQuote(undefined);
        setRevision((n) => n + 1);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const priceLine = !quote
    ? null
    : quote.priceOnRequest || quote.total == null
      ? t("common.money.price_on_request")
      : money(quote.total, quote.currency);

  return (
    <Modal title={t("rooms.confirm_booking_title")} close={close}>
      {booking ? (
        <div className="booking-confirm-success">
          <Status status={booking.status} />
          <p>
            {booking.status === "pending"
              ? t("booking.request_sent_body")
              : ["confirmed", "approved"].includes(booking.status)
                ? t("booking.confirmed_body")
                : t("booking.existing_booking_body")}
          </p>
          <p className="caption">
            {t("booking.reference", { reference: booking.reference })}
          </p>
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Link className="ds-button" to={`/booking/${booking.id}?ny=1`}>
              {t("rooms.view_booking")}
            </Link>
          </div>
        </div>
      ) : needsLogin ? (
        <div className="stack">
          <dl className="booking-confirm-summary">
            <div>
              <dt>{t("common.room")}</dt>
              <dd>{room.name}</dd>
            </div>
            <div>
              <dt>{t("common.date")}</dt>
              <dd>{displayDate(selection.date, true)}</dd>
            </div>
            <div>
              <dt>{t("common.time")}</dt>
              <dd>
                {selection.start}–{selection.end}
              </dd>
            </div>
          </dl>
          <p>{t("booking.login_required_body")}</p>
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Link
              className="ds-button"
              to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              {t("auth.log_in")}
            </Link>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <dl className="booking-confirm-summary">
            <div>
              <dt>{t("common.room")}</dt>
              <dd>{room.name}</dd>
            </div>
            <div>
              <dt>{t("common.date")}</dt>
              <dd>{displayDate(selection.date, true)}</dd>
            </div>
            <div>
              <dt>{t("common.time")}</dt>
              <dd>
                {selection.start}–{selection.end}
              </dd>
            </div>
            {priceLine && (
              <div>
                <dt>{t("booking.total_price")}</dt>
                <dd>{priceLine}</dd>
              </div>
            )}
          </dl>
          {demoOrgs && myOrgs.length > 0 ? (
            <Field>
              <Label htmlFor="card-booking-org">
                {t("booking.book_on_behalf")}
              </Label>
              <Select
                id="card-booking-org"
                value={organizationId}
                disabled={busy || Boolean(request.current)}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  request.current = undefined;
                }}
              >
                {myOrgs.map((row) => (
                  <option key={row.organization.id} value={row.organization.id}>
                    {row.organization.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {demoOrgs && myOrgs.length === 0 ? (
            <div className="stack">
              <p className="caption">{t("booking.ideal_join_intro")}</p>
              <Field>
                <Label htmlFor="card-org-search">
                  {t("booking.ideal_search_label")}
                </Label>
                <Input
                  id="card-org-search"
                  value={orgQuery}
                  maxLength={120}
                  disabled={orgBusy || busy}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  placeholder={t("booking.ideal_search_placeholder")}
                />
              </Field>
              <Button
                type="button"
                variant="secondary"
                disabled={orgBusy || orgQuery.trim().length < 2}
                onClick={() => {
                  void (async () => {
                    setOrgBusy(true);
                    setError(undefined);
                    try {
                      const hits = await api<
                        Array<{ organizationNumber: string; name: string }>
                      >(
                        `/organizations/search?q=${encodeURIComponent(orgQuery.trim())}`,
                      );
                      setOrgHits(hits);
                    } catch (e) {
                      setError(e as Error);
                    } finally {
                      setOrgBusy(false);
                    }
                  })();
                }}
              >
                {t("booking.ideal_search")}
              </Button>
              {orgHits.map((hit) => (
                <div key={hit.organizationNumber} className="row-actions">
                  <span>
                    {hit.name} ({hit.organizationNumber})
                  </span>
                  <Button
                    type="button"
                    data-size="sm"
                    disabled={orgBusy}
                    onClick={() => {
                      void (async () => {
                        setOrgBusy(true);
                        setError(undefined);
                        try {
                          const org = await post<Organization>(
                            "/organizations/verify",
                            {
                              organizationNumber: hit.organizationNumber,
                            },
                          );
                          await post("/organizations/represent", {
                            organizationId: org.id,
                          });
                          setOrgHits([]);
                          setOrgQuery("");
                          setRevision((n) => n + 1);
                        } catch (e) {
                          setError(e as Error);
                        } finally {
                          setOrgBusy(false);
                        }
                      })();
                    }}
                  >
                    {t("booking.ideal_request")}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <Field>
            <Label htmlFor="card-booking-purpose">
              {t("rooms.purpose_label")}{" "}
              <span className="optional">{t("common.optional")}</span>
            </Label>
            <Input
              id="card-booking-purpose"
              value={purpose}
              maxLength={120}
              disabled={busy || Boolean(request.current)}
              onChange={(e) => {
                onPurposeChange(e.target.value);
                request.current = undefined;
              }}
              placeholder={t("rooms.purpose_placeholder")}
            />
          </Field>
          {quote && (
            <label className="consent">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
              />
              <span>{t("booking.terms_accept", { days: cancelDays })}</span>
            </label>
          )}
          {error && (
            <>
              <ErrorState
                error={error}
                retry={!quote ? () => setRevision((n) => n + 1) : undefined}
              />
              {request.current && <p>{t("booking.retry_same_order")}</p>}
            </>
          )}
          {!quote && !error && (
            <Loading label={t("booking.checking_availability")} />
          )}
          <div className="booking-confirm-actions">
            <Button variant="secondary" type="button" onClick={close}>
              {t("common.close")}
            </Button>
            <Button type="submit" disabled={busy || !quote || !acceptedTerms}>
              {busy ? t("booking.submitting") : confirmLabel}
            </Button>
          </div>
          {quote && (
            <p className="caption">
              {quote.requiresApproval
                ? t("booking.approval_followup")
                : t("rooms.confirm_keeps_you_here")}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
