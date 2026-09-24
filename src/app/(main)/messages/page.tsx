import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listConversations } from "@/lib/data/messages";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages / OwnReach", robots: { index: false } };

export default async function MessagesPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const conversations = await listConversations(session.userId);

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="text-lg font-semibold">Messages</h1>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Visit a profile and tap Message to start a conversation."
        />
      ) : (
        conversations.map((c) => {
          const name = c.other?.displayName ?? "Unknown user";
          const preview = c.lastMessage
            ? `${c.lastMessage.senderId === session.userId ? "You: " : ""}${c.lastMessage.body}`
            : "No messages yet";
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="hover:bg-accent/30 flex items-center gap-3 border-b px-4 py-3.5 transition-colors"
            >
              <UserAvatar src={c.other?.avatarUrl} name={name} className="size-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{name}</span>
                  {c.lastMessage && (
                    <span className="text-muted-foreground shrink-0 text-xs">{formatRelativeTime(c.lastMessage.createdAt)}</span>
                  )}
                </div>
                <p className={cn("truncate text-sm", c.unread ? "text-foreground" : "text-muted-foreground")}>{preview}</p>
              </div>
              {c.unread && <span className="bg-primary size-2.5 shrink-0 rounded-full" aria-hidden />}
            </Link>
          );
        })
      )}
    </div>
  );
}
