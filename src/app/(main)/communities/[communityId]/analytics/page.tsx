import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getMembership } from "@/lib/data/communities";
import { CHANNEL_ANALYTICS_RANGES, getChannelAnalytics, parseChannelAnalyticsRange } from "@/lib/data/channel-analytics";
import { isCommunityManager } from "@/lib/community-roles";
import { ChannelAnalyticsChart } from "@/components/communities/channel-analytics-chart";
import { filterChipClassName } from "@/components/shell/filter-chip";
import { richTextToPlain } from "@/components/post/rich-text";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Channel analytics / OwnReach", robots: { index: false } };

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className={cn("text-2xl font-semibold tabular-nums", tone === "positive" && "text-emerald-600 dark:text-emerald-400", tone === "negative" && "text-destructive")}>
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

const number = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? `+${number(n)}` : number(n));

export default async function ChannelAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ communityId }, { range: rangeParam }] = await Promise.all([params, searchParams]);
  const [session, community] = await Promise.all([verifySession(), getCommunityBySlugOrId(communityId)]);
  if (!session) redirect("/login");
  if (!community || community.kind !== "channel") notFound();

  const membership = await getMembership(community.id, session.userId);
  if (!membership || !isCommunityManager(membership.role)) notFound();

  const range = parseChannelAnalyticsRange(rangeParam);
  const analytics = await getChannelAnalytics(community.id, range);
  const base = `/communities/${community.slug}/analytics`;

  return (
    <div>
      <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex items-center gap-2 border-b px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 backdrop-blur md:pt-3">
        <Link
          href={`/communities/${community.slug}/settings`}
          aria-label="Back to channel settings"
          className="hover:bg-accent/60 flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-semibold">Analytics</h1>
          <p className="text-muted-foreground truncate text-xs">{community.name}</p>
        </div>
      </header>

      <div className="space-y-8 px-4 py-4">
        <nav aria-label="Time period" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHANNEL_ANALYTICS_RANGES.map((r) => (
            <Link key={r.value} href={`${base}?range=${r.value}`} replace scroll={false} className={filterChipClassName(range === r.value)} aria-current={range === r.value ? "true" : undefined}>
              {r.label}
            </Link>
          ))}
        </nav>

        <section className="grid grid-cols-2 gap-3">
          <StatTile label="Total members" value={number(analytics.totalMembers)} />
          <StatTile label="Total post views" value={number(analytics.totalViews)} />
          <StatTile label="Views in period" value={number(analytics.viewsInPeriod)} />
          <StatTile label="Avg views per post" value={analytics.avgViewsPerPost === null ? "–" : number(analytics.avgViewsPerPost)} />
          <StatTile label="New members" value={number(analytics.joins)} />
          <StatTile label="Members left" value={number(analytics.leaves)} />
          <div className="col-span-2">
            <StatTile
              label="Net member growth"
              value={signed(analytics.netGrowth)}
              tone={analytics.netGrowth > 0 ? "positive" : analytics.netGrowth < 0 ? "negative" : undefined}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Trend</h2>
          <ChannelAnalyticsChart points={analytics.points} granularity={analytics.granularity} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold">Most viewed posts</h2>
          <p className="text-muted-foreground mb-3 text-xs">Posts published in this period.</p>
          {analytics.topPosts.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No posts in this period.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {analytics.topPosts.map((post) => {
                const text = richTextToPlain(post.body).trim();
                return (
                  <li key={post.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm wrap-break-word">{text || "Photo, poll or contact"}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{formatRelativeTime(new Date(post.createdAt))}</p>
                    </div>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm tabular-nums">
                      <Eye className="size-4" />
                      {number(post.views)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
