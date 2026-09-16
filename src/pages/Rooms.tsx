import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  Grid2X2,
  List,
  Map as MapIcon,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { useApi } from "../api";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  SearchFields,
  validateSearch,
} from "../components/ui";
import { RoomCard } from "../components/RoomCard";
import type { Availability, Room, Search } from "../../shared/types";
import { defaultSearch, displayDate, searchParams } from "../../shared/time";
import { useApp } from "../context";
export function readSearch(params: URLSearchParams): Search {
  const d = defaultSearch();
  return {
    date: params.get("date") || d.date,
    start: params.get("start") || d.start,
    end: params.get("end") || d.end,
    people: Number(params.get("people") || d.people),
  };
}
export function Rooms() {
  const { config } = useApp();
  const [params, setParams] = useSearchParams();
  const selected = useMemo(() => readSearch(params), [params]);
  const searched = params.has("date");
  const [draft, setDraft] = useState(selected);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [floorplan, setFloorplan] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rooms = useApi<Room[]>("/rooms");
  const availability = useApi<Availability[]>(
    searched && !validateSearch(selected)
      ? `/availability?${searchParams(selected)}`
      : null,
  );
  const statuses = new Map(availability.data?.map((a) => [a.roomId, a]));
  const hasErrors = availability.data?.some((a) => a.state === "error");
  const filtered = (rooms.data || []).filter(
    (r) =>
      !searched ||
      !availability.data ||
      showAll ||
      statuses.get(r.id)?.state !== "unavailable",
  );
  const availableCount =
    availability.data?.filter((a) => a.state === "available").length ?? 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateSearch(draft);
    setError(problem);
    if (!problem) {
      setParams(searchParams(draft));
      setShowAll(false);
    }
  };
  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <div className="eyebrow heading-eyebrow">
            <Building2 size={16} />
            Et sted å møtes
          </div>
          <h1>Finn rommet til ditt neste møte</h1>
          <p>Velg et rom, eller finn ut hva som er ledig når du trenger det.</p>
        </div>
        {config?.floorplanAvailable && (
          <Button
            variant="secondary"
            data-size="sm"
            onClick={() => setFloorplan(true)}
          >
            <MapIcon size={18} />
            Plantegning
          </Button>
        )}
      </div>
      <form className="search-panel" onSubmit={submit}>
        <SearchFields value={draft} onChange={setDraft} />
        <Button type="submit" className="search-submit">
          <SearchIcon size={19} />
          Vis ledige rom
        </Button>
      </form>
      {(error || (searched && validateSearch(selected))) && (
        <ErrorState error={error || validateSearch(selected)!} />
      )}
      {searched && !error && !validateSearch(selected) && (
        <div className="search-summary">
          <CalendarDays size={17} />
          <span>
            {displayDate(selected.date)} · {selected.start}–{selected.end} ·{" "}
            {selected.people} {selected.people === 1 ? "person" : "personer"}
          </span>
          <button
            onClick={() => {
              setParams({});
              setShowAll(false);
            }}
            aria-label="Nullstill filtre"
          >
            <X size={16} />
            Nullstill
          </button>
        </div>
      )}
      <div className="results-heading">
        <div>
          <h2>
            {searched && availability.data
              ? `${availableCount} ${availableCount === 1 ? "rom" : "rom"} ledige`
              : "Våre møterom"}
          </h2>
          <span className="muted">
            {searched
              ? "For hele tidsrommet ditt"
              : `${rooms.data?.length ?? 7} rom · små møter og større samlinger`}
          </span>
        </div>
        <div className="view-switch" role="group" aria-label="Visning">
          <button
            aria-label="Kortvisning"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={19} />
          </button>
          <button
            aria-label="Listevisning"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={20} />
          </button>
        </div>
      </div>
      {rooms.error ? (
        <ErrorState error={rooms.error} retry={rooms.reload} />
      ) : rooms.loading || availability.loading ? (
        <Loading label="Henter rom og ledighet …" />
      ) : (
        <>
          {availability.error && (
            <ErrorState
              error={availability.error}
              retry={availability.reload}
            />
          )}
          {hasErrors && (
            <ErrorState
              error="Vi kunne ikke hente ledigheten for alle rom. Prøv igjen før du bestiller."
              retry={availability.reload}
            />
          )}
          {filtered.length ? (
            <div
              className={`rooms-grid ${view === "list" ? "rooms-list" : ""}`}
            >
              {filtered.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  list={view === "list"}
                  availability={statuses.get(room.id)}
                  query={searched ? searchParams(selected) : ""}
                />
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarDays size={32} />}
              title="Ingen rom passer dette tidspunktet"
            >
              <p>
                Prøv et annet tidsrom, eller se rommene for å finne et
                alternativ.
              </p>
              <Button variant="secondary" onClick={() => setShowAll(true)}>
                Se alle rom
              </Button>
            </Empty>
          )}
          {searched &&
            !showAll &&
            availableCount > 0 &&
            availableCount < (rooms.data?.length ?? 0) && (
              <Button
                className="show-all"
                variant="tertiary"
                onClick={() => setShowAll(true)}
              >
                Vis også rom som ikke er ledige
              </Button>
            )}
        </>
      )}
      {config?.mode === "demo" && (
        <p className="inventory-note">
          Romnavn og kapasitetsintervaller er hentet fra romoversikten. Demoen
          bruker nedre kapasitetsgrense. Rommene vises med illustrasjonsfoto,
          ikke fotografier av byggets rom.
        </p>
      )}
      {floorplan && (
        <Modal title="Plantegning" close={() => setFloorplan(false)} wide>
          <img
            className="floorplan"
            src="/api/floorplan"
            alt="Plantegning med Sauda 1, Sauda 2, Tysso, Glomma 1, Glomma 2 og to rom merket Eidefossen."
          />
          <p className="muted">
            De to Eidefossen-rommene må få endelige navn før lansering.
          </p>
        </Modal>
      )}
    </div>
  );
}
