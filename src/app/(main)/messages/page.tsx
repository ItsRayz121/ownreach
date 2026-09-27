import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listConversations } from "@/lib/data/messages";
import { searchProfiles } from "@/lib/data/profiles";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { HeaderSearchToggle } from "@/components/header-search-toggle";
import { StartConversationRow } from "@/components/messages/start-conversation-row";
import { MessageRequestRow } from "@/components/messages/message-request-row";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages / OwnReach", robots: { index: false } };

type Filter = "all" | "unread" | "requests";

function lastMessageText(m: { body: string; isPoll: boolean; isContact: boolean }): string {
  if (m.isPoll) return "📊 Poll";
  if (m.isContact) return "👤 Contact";
  return m.body;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q, filter: filterParam } = await searchParams;
  const filter: Filter = filterParam === "unread" || filterParam === "requests" ? filterParam : "all";
  const query = q?.trim();
  const session = await verifySession();
  if (!session) redirect("/login");

  const [conversations, profileResults] = await Promise.all([
    listConversations(session.userId),
    query ? searchProfiles(query.replace(/^@/, ""), { excludeUserId: session.userId }) : Promise.resolve({ matches: [], suggestions: [] }),
  ]);
  const { matches: results, suggestions } = profileResults;

  const requests = conversations.filter((c) => c.status === "pending" && c.initiatorId !== session.userId);
  const visibleConversations = conversations.filter((c) => {
    if (c.status === "pending" && c.initiatorId !== session.userId) return false; // shown under Requests instead
    if (filter === "unread") return c.unread;
    return true;
  });
  const list = filter === "requests" ? requests : visibleConversations;

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 flex items-center justify-between gap-2 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="text-lg font-semibold">Chats</h1>
        <HeaderSearchToggle action="/messages" name="q" placeholder="Search @username" defaultValue={query} />
      </div>

      <div className="flex gap-4 border-b px-4">
        <FilterTab href="/messages" active={filter === "all"} label="All" />
        <FilterTab href="/messages?filter=unread" active={filter === "unread"} label="Unread" />
        <FilterTab href="/messages?filter=requests" active={filter === "requests"} label="Requests" count={requests.length} />
      </div>

      {query && (
        <div className="border-b">
          <h2 className="text-muted-foreground px-4 pt-4 pb-2 text-xs font-semibold tracking-wide uppercase">People</h2>
          {results.length === 0 && suggestions.length === 0 ? (
            <p className="text-muted-foreground px-4 pb-4 text-sm">No one found for &quot;{query}&quot;.</p>
          ) : (
            <>
              {results.map((profile) => (
                <StartConversationRow
                  key={profile.userId}
                  userId={profile.userId}
                  username={profile.username}
                  displayName={profile.displayName}
                  avatarUrl={profile.avatarUrl}
                />
              ))}
              {suggestions.length > 0 && (
                <>
                  <h3 className="text-muted-foreground px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                    Did you mean
                  </h3>
                  {suggestions.map((profile) => (
                    <StartConversationRow
                      key={profile.userId}
                      userId={profile.userId}
                      username={profile.username}
                      displayName={profile.displayName}
                      avatarUrl={profile.avatarUrl}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={filter === "requests" ? "No message requests" : "No messages yet"}
          description={
            filter === "requests"
              ? "Requests from people you don't follow back will show up here."
              : "Search a username above, or visit a profile and tap Message to start a conversation."
          }
        />
      ) : filter === "requests" ? (
        list.map((c) => (
          <MessageRequestRow
            key={c.id}
            conversationId={c.id}
            displayName={c.other?.displayName ?? "Unknown user"}
            avatarUrl={c.other?.avatarUrl ?? null}
            preview={c.lastMessage ? lastMessageText(c.lastMessage) : "Sent you a message request"}
          />
        ))
      ) : (
        list.map((c) => {
          const name = c.other?.displayName ?? "Unknown user";
          const preview = c.lastMessage
            ? `${c.lastMessage.senderId === session.userId ? "You: " : ""}${lastMessageText(c.lastMessage)}`
            : c.status === "pending"
              ? "Message request sent"
              : c.status === "declined"
                ? "Message request declined"
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

function FilterTab({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "text-muted-foreground border-transparent hover:text-foreground"
      )}
    >
      {label}
      {Boolean(count) && (
        <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          {count}
        </span>
      )}
    </Link>
  );
}
