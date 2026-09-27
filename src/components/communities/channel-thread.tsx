"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Eye, Settings } from "lucide-react";
import { RichText } from "@/components/post/rich-text";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markCommunityRead, loadOlderChannelMessages, viewChannelMessages } from "@/lib/actions/communities";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { MemberAvatarStack } from "./member-avatar-stack";
import { ChannelComposer } from "./channel-composer";
import type { ChannelMessageItem } from "@/lib/data/communities";

interface ThreadMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ChannelThreadProps {
  channelId: string;
  communityId: string;
  communitySlug: string;
  channelName: string;
  avatarUrl: string | null;
  viewerId: string;
  members: ThreadMember[];
  canManage: boolean;
  canPost: boolean;
  showViews: boolean;
  initialMessages: ChannelMessageItem[];
  initialNextCursor: string | null;
}

export function ChannelThread({
  channelId,
  communityId,
  communitySlug,
  channelName,
  avatarUrl,
  viewerId,
  members,
  canManage,
  canPost,
  showViews,
  initialMessages,
  initialNextCursor,
}: ChannelThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const viewedRef = useRef(new Set<string>());
  const senderMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  useEffect(() => {
    markCommunityRead(communityId).catch(() => {});
  }, [communityId]);

  useEffect(() => {
    if (!showViews) return;
    const unseen = messages.filter((m) => m.senderId !== viewerId && !viewedRef.current.has(m.id)).map((m) => m.id);
    if (unseen.length === 0) return;
    unseen.forEach((id) => viewedRef.current.add(id));
    viewChannelMessages(channelId, unseen).catch(() => {});
  }, [messages, showViews, channelId, viewerId]);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  function appendMessage(message: ChannelMessageItem) {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  useAblyChannel<{ id: string; body: string; senderId: string; createdAt: string }>(
    `channel:${channelId}`,
    "message",
    (data) => appendMessage({ ...data, createdAt: new Date(data.createdAt), viewCount: 0 })
  );

  function handleLoadOlder() {
    if (!nextCursor) return;
    startLoadOlder(async () => {
      const { items, nextCursor: newCursor } = await loadOlderChannelMessages(channelId, nextCursor);
      setMessages((prev) => [...items, ...prev]);
      setNextCursor(newCursor);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-2.5 border-b px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <UserAvatar src={avatarUrl} name={channelName} className="size-8 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-semibold">{channelName}</span>
          <span className="text-muted-foreground truncate text-xs">@{communitySlug}</span>
        </span>
        <MemberAvatarStack members={members} />
        {canManage && (
          <Link
            href={`/communities/${communitySlug}/settings`}
            className="text-muted-foreground hover:text-foreground rounded-full p-1.5 hover:bg-accent/60"
            aria-label="Community settings"
          >
            <Settings className="size-4" />
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {nextCursor && (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              className="text-primary text-sm font-medium hover:underline disabled:opacity-50"
            >
              {isLoadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === viewerId;
          const sender = senderMap.get(m.senderId);
          return (
            <div key={m.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <UserAvatar src={sender?.avatarUrl} name={sender?.displayName ?? "Member"} className="size-7 shrink-0" />}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {!mine && <p className="mb-0.5 text-xs font-medium opacity-80">{sender?.displayName ?? "Member"}</p>}
                <RichText text={m.body} />
                <div
                  className={cn(
                    "mt-0.5 flex items-center gap-2 text-[10px]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}
                >
                  <span>{formatRelativeTime(m.createdAt)}</span>
                  {showViews && mine && (
                    <span className="flex items-center gap-0.5" title={`${m.viewCount} view${m.viewCount === 1 ? "" : "s"}`}>
                      <Eye className="size-2.5" />
                      {m.viewCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <ChannelComposer channelId={channelId} onSent={appendMessage} />
      ) : (
        <div className="text-muted-foreground border-t px-4 py-3 text-center text-sm">
          Only admins can post in this channel.
        </div>
      )}
    </div>
  );
}
