import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getEngagementSummary, getFollowerGrowth, getTopPosts } from "@/lib/data/analytics";
import { FollowerGrowthChart } from "@/components/settings/follower-growth-chart";
import { formatRelativeTime } from "@/lib/format";

export const metadata = { title: "Analytics / OwnReach" };

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export default async function AnalyticsSettingsPage() {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/analytics");

  const [summary, growth, topPosts] = await Promise.all([
    getEngagementSummary(session.userId),
    getFollowerGrowth(session.userId, 30),
    getTopPosts(session.userId, 5),
  ]);

  return (
    <div className="space-y-8 px-4 py-6">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Posts" value={summary.totalPosts} />
          <StatTile label="Likes received" value={summary.totalLikes} />
          <StatTile label="Comments received" value={summary.totalComments} />
          <StatTile label="Followers" value={summary.totalFollowers} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Follower growth (last 30 days)</h2>
        <FollowerGrowthChart points={growth} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Top posts</h2>
        </div>
        {topPosts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No posts yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {topPosts.map((post) => (
              <li key={post.id} className="px-4 py-3">
                <p className="line-clamp-2 text-sm wrap-break-word">{post.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatRelativeTime(post.createdAt)} · {post.likeCount} like{post.likeCount === 1 ? "" : "s"} ·{" "}
                  {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Audience export</h2>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
        <a
          href="/api/settings/analytics/export"
          className="border-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
        >
          <Download className="size-4" />
          Export followers (CSV)
        </a>
      </section>
    </div>
  );
}
