import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InsightsTrendPoint } from "../../../shared/types";
import { useFormatters, useT } from "../../i18n";

type Measure = "timer" | "antall";

type TrendRow = InsightsTrendPoint & {
  current: number;
  previous: number;
};

function readChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent:
      styles.getPropertyValue("--ds-color-accent-base-default").trim() ||
      "#003057",
    compare:
      styles.getPropertyValue("--ds-color-neutral-text-subtle").trim() ||
      "#7a90a4",
    grid:
      styles.getPropertyValue("--ds-color-neutral-border-subtle").trim() ||
      "#d6dde5",
    text:
      styles.getPropertyValue("--ds-color-neutral-text-subtle").trim() ||
      "#5c6b7a",
  };
}

export function TrendChart({
  points,
  grain,
  measure,
  onMeasure,
  compare,
}: {
  points: InsightsTrendPoint[];
  grain: "week" | "month";
  measure: Measure;
  onMeasure: (value: Measure) => void;
  compare: boolean;
}) {
  const { t } = useT();
  const { formatCount, formatHours, displayDate } = useFormatters();
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    const withActivity = [...points]
      .reverse()
      .find((point) => point.reservedHours > 0 || point.bookingCount > 0);
    return withActivity?.date ?? points.at(-1)?.date ?? null;
  });
  const [colors, setColors] = useState(readChartColors);

  useEffect(() => {
    const sync = () => setColors(readChartColors());
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-color-scheme", "class", "style"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (points.some((p) => p.date === selectedKey)) return;
    const withActivity = [...points]
      .reverse()
      .find((point) => point.reservedHours > 0 || point.bookingCount > 0);
    setSelectedKey(withActivity?.date ?? points.at(-1)?.date ?? null);
  }, [points, selectedKey]);

  const format = measure === "antall" ? formatCount : formatHours;
  const measureLabel =
    measure === "antall"
      ? t("admin.insights.bookings_starting")
      : t("admin.insights.reserved_hours");
  const rows = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        current:
          measure === "antall" ? point.bookingCount : point.reservedHours,
        previous:
          measure === "antall"
            ? (point.previousBookingCount ?? 0)
            : (point.previousReservedHours ?? 0),
      })),
    [points, measure],
  );
  const selected = points.find((point) => point.date === selectedKey) ?? null;
  const caption =
    grain === "month"
      ? t("admin.insights.chart_per_month", {
          unit:
            measure === "antall"
              ? t("admin.insights.unit_count")
              : t("admin.insights.unit_hours"),
        })
      : t("admin.insights.chart_per_week", {
          unit:
            measure === "antall"
              ? t("admin.insights.unit_count")
              : t("admin.insights.unit_hours"),
        });

  const selectPoint = (data: unknown) => {
    const point = data as { date?: string };
    if (point.date) setSelectedKey(point.date);
  };

  const barOpacity = (date: string) =>
    !selectedKey || date === selectedKey ? 1 : 0.32;

  return (
    <figure className="insights-trend-chart">
      <div className="insights-trend-toolbar">
        <p className="insights-trend-caption">{caption}</p>
        <div
          className="view-switch"
          role="group"
          aria-label={t("admin.insights.trend")}
        >
          <button
            type="button"
            aria-pressed={measure === "timer"}
            onClick={() => onMeasure("timer")}
          >
            {t("admin.insights.hours")}
          </button>
          <button
            type="button"
            aria-pressed={measure === "antall"}
            onClick={() => onMeasure("antall")}
          >
            {t("admin.insights.count")}
          </button>
        </div>
      </div>
      <div className="insights-trend-frame">
        <div className="insights-trend-plot">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={rows}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="18%"
              barGap={3}
            >
              <CartesianGrid
                stroke={colors.grid}
                strokeWidth={1}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.text, fontSize: 12 }}
                axisLine={{ stroke: colors.grid }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: colors.text, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(value: number) => format(value)}
              />
              <Tooltip
                cursor={{
                  fill: colors.accent,
                  fillOpacity: 0.06,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const point = payload[0].payload as TrendRow;
                  return (
                    <div className="insights-trend-tooltip">
                      <strong>{point.label}</strong>
                      <span>
                        {displayDate(point.from)}–
                        {displayDate(point.toInclusive)}
                      </span>
                      <span>
                        {measureLabel}: {format(point.current)}
                      </span>
                      {compare ? (
                        <span>
                          {t("admin.insights.previous_period")}:{" "}
                          {format(point.previous)}
                        </span>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="current"
                name={t("admin.insights.selected_period")}
                fill={colors.accent}
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
                onClick={selectPoint}
                cursor="pointer"
              >
                {rows.map((row) => (
                  <Cell
                    key={`current-${row.date}`}
                    fill={colors.accent}
                    fillOpacity={barOpacity(row.date)}
                  />
                ))}
              </Bar>
              {compare ? (
                <Bar
                  dataKey="previous"
                  name={t("admin.insights.previous_period")}
                  fill={colors.compare}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  onClick={selectPoint}
                  cursor="pointer"
                >
                  {rows.map((row) => (
                    <Cell
                      key={`previous-${row.date}`}
                      fill={colors.compare}
                      fillOpacity={barOpacity(row.date)}
                    />
                  ))}
                </Bar>
              ) : null}
            </BarChart>
          </ResponsiveContainer>
          {compare ? (
            <ul className="insights-trend-legend">
              <li>
                <i style={{ background: colors.accent }} />
                {t("admin.insights.selected_period")}
              </li>
              <li>
                <i style={{ background: colors.compare }} />
                {t("admin.insights.previous_period")}
              </li>
            </ul>
          ) : null}
        </div>
        <aside className="insights-trend-detail" aria-live="polite">
          {selected ? (
            <>
              <h3>{selected.label}</h3>
              <p className="muted">
                {displayDate(selected.from, true)}–
                {displayDate(selected.toInclusive, true)}
              </p>
              <dl className="insights-trend-stats">
                <div>
                  <dt>{t("admin.insights.reserved_hours")}</dt>
                  <dd>{formatHours(selected.reservedHours)}</dd>
                </div>
                <div>
                  <dt>{t("admin.insights.bookings_starting")}</dt>
                  <dd>{formatCount(selected.bookingCount)}</dd>
                </div>
                {compare ? (
                  <>
                    <div>
                      <dt>{t("admin.insights.previous_hours")}</dt>
                      <dd>
                        {formatHours(selected.previousReservedHours ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("admin.insights.previous_count")}</dt>
                      <dd>{formatCount(selected.previousBookingCount ?? 0)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              {selected.incomplete ? (
                <p className="caption">
                  {grain === "month"
                    ? t("admin.insights.ongoing_month")
                    : t("admin.insights.ongoing_week")}
                </p>
              ) : null}
              <p className="caption">{t("admin.insights.chart_click_hint")}</p>
            </>
          ) : (
            <p className="muted">{t("admin.insights.chart_select_hint")}</p>
          )}
        </aside>
      </div>
    </figure>
  );
}
