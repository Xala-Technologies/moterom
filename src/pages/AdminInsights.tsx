import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, CalendarDays } from "lucide-react";
import { useApp } from "../context";
import { useApi } from "../api";
import {
  Empty,
  ErrorState,
  Field,
  Input,
  Label,
  Loading,
  Select,
} from "../components/ui";
import { BarList, CoverageBanner } from "../components/insights/BarList";
import { TrendChart } from "../components/insights/TrendChart";
import type {
  InsightsEnvelope,
  InsightsRoomRow,
  Room,
} from "../../shared/types";
import { osloDateFromMs } from "../../shared/time";
import { roomCopy, useFormatters, useI18nLocale, useT } from "../i18n";

type SortKey =
  "name" | "capacity" | "bookingCount" | "reservedHours" | "average";

export function AdminInsights({ rooms }: { rooms: Room[] }) {
  const { config } = useApp();
  const { t } = useT();
  const { displayDate, shortTime } = useFormatters();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "reservedHours",
    dir: "desc",
  });
  const roomId = params.get("rom") || undefined;
  const measure = params.get("mal") === "antall" ? "antall" : "timer";
  const query = insightsQuery(params);
  const result = useApi<InsightsEnvelope>(`/admin/insights?${query}`);
  const patch = (next: Record<string, string | null>) => {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") copy.delete(key);
      else copy.set(key, value);
    }
    setParams(copy, { replace: true });
  };

  if (result.error)
    return <ErrorState error={result.error} retry={result.reload} />;
  if (result.loading || !result.data) return <Loading />;

  const data = result.data;
  const lastInclusive = osloDateFromMs(data.period.toMs - 1);
  const scopedRooms = roomId
    ? data.rooms.filter((room) => room.roomId === roomId)
    : data.rooms;

  return (
    <div className="insights-page">
      <CoverageBanner>
        {data.mode === "demo" ? t("admin.insights.demo_prefix") : ""}
        {t("admin.insights.coverage_banner", {
          from: displayDate(data.period.fromMs, true),
          to: displayDate(data.period.toMs - 1, true),
          time: shortTime(data.generatedAt),
        })}
        {data.coverage === "truncated"
          ? t("admin.insights.coverage_truncated")
          : t("admin.insights.coverage_complete")}
      </CoverageBanner>
      <form className="insights-filters" onSubmit={(e) => e.preventDefault()}>
        <Field>
          <Label>{t("admin.insights.period")}</Label>
          <Select
            aria-label={t("a11y.period")}
            value={params.get("periode") || "30d"}
            onChange={(e) => {
              const periode = e.target.value;
              patch({
                periode,
                fra:
                  periode === "custom"
                    ? params.get("fra") || data.period.from
                    : null,
                til:
                  periode === "custom"
                    ? params.get("til") || lastInclusive
                    : null,
              });
            }}
          >
            <Select.Option value="7d">
              {t("admin.insights.last_7_days")}
            </Select.Option>
            <Select.Option value="30d">
              {t("admin.insights.last_30_days")}
            </Select.Option>
            <Select.Option value="90d">
              {t("admin.insights.last_90_days")}
            </Select.Option>
            <Select.Option value="custom">
              {t("admin.insights.custom")}
            </Select.Option>
          </Select>
        </Field>
        {(params.get("periode") || "30d") === "custom" && (
          <>
            <Field>
              <Label>{t("admin.insights.from")}</Label>
              <Input
                aria-label={t("a11y.from_date")}
                type="date"
                value={params.get("fra") || data.period.from}
                onChange={(e) =>
                  patch({ periode: "custom", fra: e.target.value })
                }
              />
            </Field>
            <Field>
              <Label>{t("admin.insights.to")}</Label>
              <Input
                aria-label={t("a11y.to_date")}
                type="date"
                value={params.get("til") || lastInclusive}
                onChange={(e) =>
                  patch({ periode: "custom", til: e.target.value })
                }
              />
            </Field>
          </>
        )}
        <Field>
          <Label>{t("common.room")}</Label>
          <Select
            aria-label={t("common.room")}
            value={params.get("rom") || ""}
            onChange={(e) => patch({ rom: e.target.value || null })}
          >
            <Select.Option value="">
              {t("admin.insights.all_rooms")}
            </Select.Option>
            {rooms.map((room) => (
              <Select.Option key={room.id} value={room.id}>
                {room.name}
              </Select.Option>
            ))}
          </Select>
        </Field>
        <label className="consent insights-compare">
          <input
            type="checkbox"
            checked={params.get("sammenlign") === "1"}
            onChange={(e) =>
              patch({ sammenlign: e.target.checked ? "1" : null })
            }
          />
          {t("admin.insights.compare_previous")}
        </label>
      </form>
      <InsightsOverview
        data={data}
        rooms={scopedRooms}
        measure={measure}
        onMeasure={(value) =>
          patch({ mal: value === "antall" ? "antall" : null })
        }
        sort={sort}
        onSort={setSort}
      />
      <p className="caption">
        {data.definitions.map((item) => item.label).join(" ")}
        {config?.mode === "demo" ? t("admin.insights.demo_rules_note") : ""}
      </p>
    </div>
  );
}

function InsightsOverview({
  data,
  rooms,
  measure,
  onMeasure,
  sort,
  onSort,
}: {
  data: InsightsEnvelope;
  rooms: InsightsRoomRow[];
  measure: "timer" | "antall";
  onMeasure: (value: "timer" | "antall") => void;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (next: { key: SortKey; dir: "asc" | "desc" }) => void;
}) {
  const { t } = useT();
  const { locale } = useI18nLocale();
  const { formatCount, formatHours, bcp47 } = useFormatters();
  const rows = useMemo(
    () => sortRooms(rooms, sort, bcp47),
    [rooms, sort, bcp47],
  );
  return (
    <>
      <div className="admin-stats insights-summary">
        <div className="stat">
          <div>
            <span>{t("admin.insights.reserved_hours")}</span>
            <strong>{formatHours(data.totals.reservedHours)}</strong>
          </div>
          <span className="stat-icon">
            <CalendarDays size={20} />
          </span>
        </div>
        <div className="stat">
          <div>
            <span>{t("admin.insights.bookings_starting")}</span>
            <strong>{formatCount(data.totals.bookingCount)}</strong>
          </div>
          <span className="stat-icon">
            <Building2 size={20} />
          </span>
        </div>
        {data.compareTotals && (
          <div className="stat">
            <div>
              <span>{t("admin.insights.hours_change")}</span>
              <strong>
                {changeLabel(
                  data.totals.reservedHours,
                  data.compareTotals.reservedHours,
                  formatHours,
                  t,
                )}
              </strong>
            </div>
          </div>
        )}
      </div>
      <div className="section-heading">
        <h2>{t("admin.insights.trend")}</h2>
      </div>
      {data.trend.length ? (
        <TrendChart
          points={data.trend}
          grain={data.trendGrain}
          measure={measure}
          onMeasure={onMeasure}
          compare={Boolean(data.comparePeriod)}
        />
      ) : (
        <Empty title={t("admin.insights.empty_trend_title")}>
          <p>{t("admin.insights.empty_trend_body")}</p>
        </Empty>
      )}
      <div className="section-heading">
        <h2>{t("admin.insights.rooms_compared")}</h2>
      </div>
      <BarList
        caption={t("admin.insights.hours_per_room_caption")}
        format={formatHours}
        items={rooms.map((room) => ({
          key: room.roomId,
          label: room.name,
          value: room.reservedHours,
        }))}
      />
      <div className="section-heading">
        <h2>{t("admin.insights.rooms_table")}</h2>
      </div>
      <div className="insights-table-wrap">
        <table className="insights-table">
          <thead>
            <tr>
              <SortHeader
                label={t("admin.insights.rooms_table")}
                column="name"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label={t("admin.insights.capacity")}
                column="capacity"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label={t("admin.insights.reservations")}
                column="bookingCount"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label={t("admin.insights.hours")}
                column="reservedHours"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label={t("admin.insights.avg_duration")}
                column="average"
                sort={sort}
                onSort={onSort}
              />
              {data.comparePeriod && (
                <th scope="col">{t("admin.insights.hours_change_col")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((room) => {
              const copy = roomCopy(room, locale);
              return (
                <tr key={room.roomId}>
                  <th scope="row">{room.name}</th>
                  <td>{copy.capacityLabel}</td>
                  <td>{formatCount(room.bookingCount)}</td>
                  <td>{formatHours(room.reservedHours)}</td>
                  <td>
                    {room.averageDurationHours === null
                      ? t("admin.insights.no_reservations")
                      : t("admin.insights.hours_unit_suffix", {
                          value: formatHours(room.averageDurationHours),
                        })}
                  </td>
                  {data.comparePeriod && (
                    <td>
                      {changeLabel(
                        room.reservedHours,
                        room.previousReservedHours,
                        formatHours,
                        t,
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (next: { key: SortKey; dir: "asc" | "desc" }) => void;
}) {
  const active = sort.key === column;
  return (
    <th scope="col">
      <button
        type="button"
        className="sort-button"
        aria-pressed={active}
        onClick={() =>
          onSort({
            key: column,
            dir: active && sort.dir === "desc" ? "asc" : "desc",
          })
        }
      >
        {label}
        {active ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}

function sortRooms(
  rooms: InsightsRoomRow[],
  sort: { key: SortKey; dir: "asc" | "desc" },
  bcp47: string,
) {
  const copy = [...rooms];
  copy.sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "name") return a.name.localeCompare(b.name, bcp47) * dir;
    if (sort.key === "capacity") return (a.capacity - b.capacity) * dir;
    if (sort.key === "bookingCount")
      return (a.bookingCount - b.bookingCount) * dir;
    if (sort.key === "average")
      return (
        ((a.averageDurationHours ?? -1) - (b.averageDurationHours ?? -1)) * dir
      );
    return (a.reservedHours - b.reservedHours) * dir;
  });
  return copy;
}

function changeLabel(
  current: number,
  previous: number | undefined,
  format: (value: number) => string,
  t: (key: string, options?: Record<string, string>) => string,
) {
  if (previous === undefined) return "—";
  if (previous === 0 && current === 0) return t("admin.insights.unchanged");
  if (previous === 0)
    return t("admin.insights.from_zero", { value: format(current) });
  const delta = current - previous;
  return `${delta > 0 ? "+" : ""}${format(delta)}`;
}

function insightsQuery(params: URLSearchParams) {
  const query = new URLSearchParams();
  const periode = params.get("periode") || "30d";
  query.set("periode", periode);
  if (periode === "custom") {
    if (params.get("fra")) query.set("fra", params.get("fra")!);
    if (params.get("til")) query.set("til", params.get("til")!);
  }
  if (params.get("rom")) query.set("rom", params.get("rom")!);
  if (params.get("sammenlign") === "1") query.set("sammenlign", "1");
  return query.toString();
}
