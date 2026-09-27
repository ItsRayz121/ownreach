import type { AnalyticsRange, FollowerGrowthPoint } from "@/lib/data/analytics";

const CHART_HEIGHT = 64;
const BAR_GAP = 2;

// Bucket keys from analytics.ts are UTC wall-clock values with no "Z" suffix
// (e.g. "2024-01-01T00:00:00") — without one, JS parses a date-time string as
// local time, and formatting would then apply the server/viewer's local
// offset on top of that. Appending "Z" and formatting with timeZone: "UTC"
// keeps the label matching the UTC bucket the data was actually grouped by,
// regardless of where this renders.
function formatLabel(iso: string, range: AnalyticsRange): string {
  const d = new Date(`${iso}Z`);
  if (range === "24h") return d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
  if (range === "1y") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Single-series magnitude chart: one hue (the app's own primary accent,
// reused rather than introducing a new palette), thin bars with rounded
// data-ends, a 2px gap between bars, and a screen-reader-only table
// carrying the same data (see dataviz skill: form + accessibility pass).
export function FollowerGrowthChart({ points, range }: { points: FollowerGrowthPoint[]; range: AnalyticsRange }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const barWidth = 100 / points.length;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label="Follower growth over the selected period"
      >
        {points.map((p, i) => {
          const barHeight = Math.max(2, (p.count / max) * (CHART_HEIGHT - 4));
          const x = i * barWidth + BAR_GAP / 2;
          const w = Math.max(0.5, barWidth - BAR_GAP);
          return (
            <rect
              key={p.date}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={w}
              height={barHeight}
              rx={Math.min(1.5, w / 2)}
              className="fill-primary"
            >
              <title>{`${formatLabel(p.date, range)}: ${p.count} new follower${p.count === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{points[0] && formatLabel(points[0].date, range)}</span>
        <span>{points.at(-1) && formatLabel(points.at(-1)!.date, range)}</span>
      </div>
      <table className="sr-only">
        <caption>Follower growth</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>New followers</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatLabel(p.date, range)}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
