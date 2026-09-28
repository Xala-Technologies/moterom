import { useMemo } from "react";

export type ChartItem = {
  key: string;
  label: string;
  value: number;
  note?: string;
};

export function BarList({
  items,
  format,
  caption,
}: {
  items: ChartItem[];
  format: (value: number) => string;
  caption: string;
}) {
  const ranked = useMemo(
    () =>
      [...items].sort(
        (a, b) => b.value - a.value || a.label.localeCompare(b.label),
      ),
    [items],
  );
  const max = Math.max(0, ...ranked.map((item) => item.value));
  return (
    <figure className="insights-chart horizontal">
      <div className="insights-bars" role="img" aria-label={caption}>
        {ranked.map((item) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div className="insights-bar-row" key={item.key}>
              <span className="insights-bar-label">{item.label}</span>
              <div className="insights-bar-track">
                <div
                  className="insights-bar-fill"
                  style={{ width: `${pct}%` }}
                  data-empty={pct <= 0 ? "true" : undefined}
                />
              </div>
              <span className="insights-bar-value">
                <span className="insights-bar-metric">
                  {format(item.value)}
                </span>
                {item.note ? (
                  <span className="insights-bar-note"> · {item.note}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
