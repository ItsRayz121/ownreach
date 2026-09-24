import type { FollowerGrowthPoint } from "@/lib/data/analytics";

const CHART_HEIGHT = 64;
const BAR_GAP = 2;

// Single-series magnitude chart: one hue (the app's own primary accent,
// reused rather than introducing a new palette), thin bars with rounded
// data-ends, a 2px gap between bars, and a screen-reader-only table
// carrying the same data (see dataviz skill: form + accessibility pass).
export function FollowerGrowthChart({ points }: { points: FollowerGrowthPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const barWidth = 100 / points.length;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label={`Follower growth over the last ${points.length} days`}
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
              <title>
                {p.date}: {p.count} new follower{p.count === 1 ? "" : "s"}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{points[0]?.date}</span>
        <span>{points.at(-1)?.date}</span>
      </div>
      <table className="sr-only">
        <caption>Follower growth by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>New followers</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
