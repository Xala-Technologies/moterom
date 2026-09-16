import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
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
import { defaultSearch, searchParams } from "../../shared/time";
import { useApp } from "../context";
import { useFormatters, useT } from "../i18n";
export function readSearch(params: URLSearchParams): Search {
  const d = defaultSearch();
  return {
    date: params.get("date") || d.date,
    start: params.get("start") || d.start,
    end: params.get("end") || d.end,
    people: 1,
  };
}
export function Rooms() {
  const { config } = useApp();
  const { t } = useT();
  const { displayDate } = useFormatters();
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
    searched && !validateSearch(selected, t)
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
    const problem = validateSearch(draft, t);
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
          <h1>{t("rooms.heading")}</h1>
          <p>{t("rooms.intro")}</p>
        </div>
        {config?.floorplanAvailable && (
          <Button
            variant="secondary"
            data-size="sm"
            onClick={() => setFloorplan(true)}
          >
            <MapIcon size={18} />
            {t("rooms.floorplan")}
          </Button>
        )}
      </div>
      <form className="search-panel" onSubmit={submit}>
        <SearchFields value={draft} onChange={setDraft} />
        <Button type="submit" className="search-submit">
          <SearchIcon size={19} />
          {t("rooms.show_available")}
        </Button>
      </form>
      {(error || (searched && validateSearch(selected, t))) && (
        <ErrorState error={error || validateSearch(selected, t)!} />
      )}
      {searched && !error && !validateSearch(selected, t) && (
        <div className="search-summary">
          <CalendarDays size={17} />
          <span>
            {displayDate(selected.date)} · {selected.start}–{selected.end}
          </span>
          <button
            onClick={() => {
              setParams({});
              setShowAll(false);
            }}
            aria-label={t("a11y.reset_filters")}
          >
            <X size={16} />
            {t("rooms.reset")}
          </button>
        </div>
      )}
      <div className="results-heading">
        <div>
          <h2>
            {searched && availability.data
              ? t("rooms.rooms_available", { count: availableCount })
              : t("rooms.our_rooms")}
          </h2>
          <span className="muted">
            {searched
              ? t("rooms.for_your_interval")
              : t("rooms.rooms_summary", {
                  count: rooms.data?.length ?? 7,
                })}
          </span>
        </div>
        <div
          className="view-switch"
          role="group"
          aria-label={t("a11y.view_mode")}
        >
          <button
            aria-label={t("a11y.grid_view")}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={19} />
          </button>
          <button
            aria-label={t("a11y.list_view")}
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
        <Loading label={t("rooms.loading_rooms")} />
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
              error={t("rooms.availability_partial_error")}
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
              title={t("rooms.empty_title")}
            >
              <p>{t("rooms.empty_body")}</p>
              <Button variant="secondary" onClick={() => setShowAll(true)}>
                {t("rooms.show_all_rooms")}
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
                {t("rooms.show_unavailable_too")}
              </Button>
            )}
        </>
      )}
      {floorplan && (
        <Modal
          title={t("rooms.floorplan")}
          close={() => setFloorplan(false)}
          wide
        >
          <img
            className="floorplan"
            src="/api/floorplan"
            alt={t("rooms.floorplan_alt")}
          />
          <p className="muted">{t("rooms.floorplan_note")}</p>
        </Modal>
      )}
    </div>
  );
}
