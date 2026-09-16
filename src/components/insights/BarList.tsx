import type { ReactNode } from "react";

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
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <figure className="insights-chart horizontal">
      <div className="insights-bars" role="img" aria-label={caption}>
        {items.map((item) => (
          <div className="insights-bar-row" key={item.key}>
            <span className="insights-bar-label">{item.label}</span>
            <div className="insights-bar-track">
              <div
                className="insights-bar-fill"
                style={{
                  width: `${max > 0 ? (item.value / max) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="insights-bar-value">
              {format(item.value)}
              {item.note ? ` · ${item.note}` : ""}
            </span>
          </div>
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function CoverageBanner({ children }: { children: ReactNode }) {
  return (
    <p className="insights-coverage" role="status">
      {children}
    </p>
  );
}
