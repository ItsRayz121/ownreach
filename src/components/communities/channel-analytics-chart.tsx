"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AnalyticsGranularity, ChannelAnalyticsPoint } from "@/lib/data/channel-analytics";

type Metric = "views" | "joins" | "leaves" | "net";

const METRICS: { value: Metric; label: string; noun: string }[] = [
  { value: "views", label: "Views", noun: "view" },
  { value: "joins", label: "Joined", noun: "new member" },
  { value: "leaves", label: "Left", noun: "member left" },
  { value: "net", label: "Net growth", noun: "net member" },
];

const CHART_HEIGHT = 96;
const BAR_GAP = 1.5;

// Bucket keys are UTC wall-clock values with no zone suffix, so they are parsed
// with an explicit "Z" and formatted in UTC to keep labels on the bucket they
// were grouped into (same approach as the follower growth chart).
function formatLabel(iso: string, granularity: AnalyticsGranularity): string {
  const d = new Date(`${iso}Z`);
  if (granularity === "hour") return d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
  if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// One series at a time (switched with the tabs), drawn as bars from a shared
// zero line so net growth can go below it. Only the value axis changes between
// metrics; a screen-reader table carries the same numbers.
export function ChannelAnalyticsChart({ points, granularity }: { points: ChannelAnalyticsPoint[]; granularity: AnalyticsGranularity }) {
  const [metric, setMetric] = useState<Metric>("views");
  const active = METRICS.find((m) => m.value === metric)!;

  const values = points.map((p) => p[metric]);
  const maxUp = Math.max(0, ...values);
  const maxDown = Math.max(0, ...values.map((v) => -v));
  const span = Math.max(1, maxUp + maxDown);
  const zeroY = (maxUp / span) * (CHART_HEIGHT - 4) + 2;
  const barWidth = 100 / points.length;

  return (
    <div>
      <div role="tablist" aria-label="Chart metric" className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {METRICS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={metric === m.value}
            onClick={() => setMetric(m.value)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors",
              metric === m.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label={`${active.label} over the selected period`}
      >
        <line x1={0} x2={100} y1={zeroY} y2={zeroY} className="stroke-border" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const value = p[metric];
          const height = value === 0 ? 1 : Math.max(1.5, (Math.abs(value) / span) * (CHART_HEIGHT - 4));
          const x = i * barWidth + BAR_GAP / 2;
          const w = Math.max(0.4, barWidth - BAR_GAP);
          const y = value < 0 ? zeroY : zeroY - height;
          return (
            <rect
              key={p.date}
              x={x}
              y={y}
              width={w}
              height={height}
              rx={Math.min(1, w / 2)}
              className={cn(value < 0 ? "fill-destructive" : metric === "leaves" ? "fill-destructive" : "fill-primary", value === 0 && "opacity-30")}
            >
              <title>{`${formatLabel(p.date, granularity)}: ${value} ${active.noun}${Math.abs(value) === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{points[0] && formatLabel(points[0].date, granularity)}</span>
        <span>{points.at(-1) && formatLabel(points.at(-1)!.date, granularity)}</span>
      </div>

      <table className="sr-only">
        <caption>Channel analytics by period</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Views</th>
            <th>Joined</th>
            <th>Left</th>
            <th>Net growth</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatLabel(p.date, granularity)}</td>
              <td>{p.views}</td>
              <td>{p.joins}</td>
              <td>{p.leaves}</td>
              <td>{p.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
