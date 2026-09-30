import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listConversations } from "@/lib/data/messages";
import { searchProfiles } from "@/lib/data/profiles";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { ListHeader, FilterChipRow, ChipCount } from "@/components/shell/list-header";
import { LogoMark } from "@/components/brand/logo";
import { filterChipClassName } from "@/components/shell/filter-chip";
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

  const needle = query?.replace(/^@/, "").toLowerCase();
  const matchesQuery = (c: (typeof conversations)[number]) =>
    !needle || Boolean(c.other && (c.other.displayName.toLowerCase().includes(needle) || c.other.username.toLowerCase().includes(needle)));

  const requests = conversations.filter((c) => c.status === "pending" && c.initiatorId !== session.userId && matchesQuery(c));
  const visibleConversations = conversations.filter((c) => {
    if (c.status === "pending" && c.initiatorId !== session.userId) return false; // shown under Requests instead
    if (filter === "unread" && !c.unread) return false;
    return matchesQuery(c);
  });
  const list = filter === "requests" ? requests : visibleConversations;

  return (
    <div>
      <ListHeader
        title="Chats"
        logo={<LogoMark size={28} />}
        searchPlaceholder="Search chats or @username"
        searchInputProps={{ name: "q", defaultValue: query }}
        searchFormAction="/messages"
        searchFormFields={filter !== "all" ? { filter } : undefined}
        searchOpen={Boolean(query)}
        searchCloseHref={chipHref(filter)}
      >
        <FilterChipRow>
          <FilterChip href={chipHref("all", query)} active={filter === "all"} label="All" />
          <FilterChip href={chipHref("unread", query)} active={filter === "unread"} label="Unread" />
          <FilterChip href={chipHref("requests", query)} active={filter === "requests"} label="Requests" count={requests.length} />
        </FilterChipRow>
      </ListHeader>

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
        query ? (
          // The People results above already cover "start a new chat" for this query.
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">No chats match &quot;{query}&quot;.</p>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title={filter === "requests" ? "No message requests" : filter === "unread" ? "You're all caught up" : "No messages yet"}
            description={
              filter === "requests"
                ? "Requests from people you don't follow back will show up here."
                : filter === "unread"
                  ? "Chats with unread messages will show up here."
                  : "Tap the search icon to find someone by name or @username, or visit a profile and tap Message."
            }
          />
        )
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

function chipHref(filter: Filter, query?: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/messages?${qs}` : "/messages";
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link href={href} className={filterChipClassName(active)} aria-current={active ? "true" : undefined}>
      {label}
      {Boolean(count) && <ChipCount count={count!} active={active} />}
    </Link>
  );
}
