import { useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, UsersRound } from "lucide-react";
import { useApi } from "../api";
import { useApp } from "../context";
import type { Availability, Room } from "../../shared/types";
import { searchParams } from "../../shared/time";
import { readSearch } from "./Rooms";
import {
  Button,
  ErrorState,
  Loading,
  SearchFields,
  validateSearch,
} from "../components/ui";
import { MonthCalendar } from "../components/MonthCalendar";
import { RoomPhoto } from "../components/RoomPhoto";
export function RoomDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, config } = useApp();
  const nav = useNavigate();
  const [search, setSearch] = useState(() => readSearch(params));
  const [error, setError] = useState<string>();
  const rooms = useApi<Room[]>("/rooms");
  const room = rooms.data?.find((r) => r.id === id);
  const availability = useApi<Availability[]>(
    !validateSearch(search) ? `/availability?${searchParams(search)}` : null,
  );
  const state = availability.data?.find((a) => a.roomId === id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const error = validateSearch(search);
    if (error) return setError(error);
    if (state?.state !== "available")
      return setError(state?.reason || "Vent til ledigheten er sjekket.");
    const next = `/bestill/${id}?${searchParams(search)}`;
    nav(user ? next : `/login?returnTo=${encodeURIComponent(next)}`);
  };
  if (rooms.loading) return <Loading />;
  if (rooms.error)
    return <ErrorState error={rooms.error} retry={rooms.reload} />;
  if (!room) return <ErrorState error="Rommet ble ikke funnet." />;
  return (
    <div className="container">
      <Link
        className="back-link"
        to={`/${params.has("date") ? `?${params}` : ""}`}
      >
        <ArrowLeft size={17} />
        Alle møterom
      </Link>
      <div className="detail-layout">
        <section>
          <RoomPhoto room={room} variant="detail" />
          <div className="detail-heading">
            <span className="eyebrow">Møterom</span>
            <h1>{room.name}</h1>
            <div className="detail-meta">
              <span>
                <UsersRound size={19} />
                {room.capacityLabel}
              </span>
              <span>
                <Clock3 size={19} />
                {room.requiresApproval
                  ? "Booking med godkjenning"
                  : "Direkte booking"}
              </span>
            </div>
          </div>
          <p className="detail-description">{room.description}</p>
          {room.amenities.length > 0 && (
            <section className="detail-section">
              <h2>Dette finner du i rommet</h2>
              <div className="detail-amenities">
                {room.amenities.map((item) => (
                  <span key={item}>
                    <CheckCircle2 size={17} />
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section className="detail-section">
            <h2>Praktisk informasjon</h2>
            <p>
              {room.arrivalInfo ||
                "Informasjon om adkomst får du sammen med bookingbekreftelsen."}
            </p>
            <p className="muted">
              Alle tidspunkt vises i norsk tid. Du ser gjennom bestillingen før
              den sendes.
            </p>
            {config?.mode === "demo" && room.nameNeedsConfirmation && (
              <p className="caption">
                Endelig romnavn og plassering må bekreftes av byggets
                administrator.
              </p>
            )}
          </section>
        </section>
        <aside className="booking-panel">
          <h2>Velg tidspunkt</h2>
          <MonthCalendar
            key={id}
            value={search.date}
            onChange={(date) => {
              setSearch({ ...search, date });
              setError(undefined);
            }}
          />
          <form onSubmit={submit}>
            <SearchFields
              compact
              value={search}
              onChange={(value) => {
                setSearch(value);
                setError(undefined);
              }}
            />
            {availability.loading ? (
              <p className="muted" role="status">
                Sjekker ledighet …
              </p>
            ) : (
              state && (
                <p
                  className={`availability-message ${state.state}`}
                  role="status"
                >
                  {state.state === "available" ? (
                    <>
                      <CheckCircle2 size={19} />
                      Ledig hele tidsrommet
                    </>
                  ) : (
                    state.reason
                  )}
                </p>
              )
            )}
            {availability.error && (
              <ErrorState
                error={availability.error}
                retry={availability.reload}
              />
            )}{" "}
            {(error || validateSearch(search)) && (
              <ErrorState error={error || validateSearch(search)!} />
            )}
            <Button
              type="submit"
              className="full-width"
              disabled={availability.loading || state?.state !== "available"}
            >
              Fortsett til bekreftelse
            </Button>
            <p className="caption align-center">
              {user
                ? "Du ser gjennom alt før du bestiller."
                : "Logg inn med e-post i neste steg."}
            </p>
          </form>
        </aside>
      </div>
    </div>
  );
}
