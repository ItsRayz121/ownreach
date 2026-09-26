import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Heart, MessageCircle, UserPlus, AtSign } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listNotifications, markAllNotificationsReadForView, type NotificationItem } from "@/lib/data/notifications";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications / OwnReach", robots: { index: false } };

const ICONS: Record<NotificationItem["type"], typeof Bell> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  mention: AtSign,
};

const VERBS: Record<NotificationItem["type"], string> = {
  follow: "followed you",
  like: "liked your post",
  comment: "commented on your post",
  mention: "mentioned you",
};

function notificationHref(n: NotificationItem): string {
  if (n.type === "follow") return n.actor ? `/${n.actor.username}` : "/home";
  return n.postId ? `/post/${n.postId}` : "/home";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const session = await verifySession();
  if (!session) redirect("/login");

  const { items, nextCursor } = await listNotifications(session.userId, cursor);
  // Opening the first page clears the unread badge; the list below still
  // reflects each row's read state as of the moment it was fetched, so
  // unread rows stay visually distinct for this visit.
  if (!cursor) await markAllNotificationsReadForView(session.userId);

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="text-lg font-semibold">Notifications</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Likes, comments, follows, and mentions will show up here."
        />
      ) : (
        <>
          {items.map((n) => {
            const Icon = ICONS[n.type];
            const actorName = n.actor?.displayName ?? "Someone";
            return (
              <Link
                key={n.id}
                href={notificationHref(n)}
                className={cn(
                  "flex items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-accent/40",
                  !n.read && "bg-accent/20"
                )}
              >
                <div className="relative shrink-0">
                  <UserAvatar src={n.actor?.avatarUrl} name={actorName} className="size-9" />
                  <span className="bg-background absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border">
                    <Icon className="text-muted-foreground size-2.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{actorName}</span>{" "}
                    {n.actor && <span className="text-muted-foreground">@{n.actor.username}</span>} {VERBS[n.type]}
                  </p>
                  <p className="text-muted-foreground text-xs">{formatRelativeTime(n.createdAt)}</p>
                </div>
              </Link>
            );
          })}
          {nextCursor && (
            <div className="p-4 text-center">
              <Link href={`/notifications?cursor=${nextCursor}`} className="text-primary text-sm font-medium hover:underline">
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
