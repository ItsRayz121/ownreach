"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Hash } from "lucide-react";
import { RichText } from "@/components/post/rich-text";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markCommunityRead, loadOlderChannelMessages } from "@/lib/actions/communities";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { MemberAvatarStack } from "./member-avatar-stack";
import { ChannelComposer } from "./channel-composer";
import type { ChannelMessageItem } from "@/lib/data/communities";

interface ThreadMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ChannelThreadProps {
  channelId: string;
  communityId: string;
  channelName: string;
  viewerId: string;
  members: ThreadMember[];
  initialMessages: ChannelMessageItem[];
  initialNextCursor: string | null;
}

export function ChannelThread({
  channelId,
  communityId,
  channelName,
  viewerId,
  members,
  initialMessages,
  initialNextCursor,
}: ChannelThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const senderMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  useEffect(() => {
    markCommunityRead(communityId).catch(() => {});
  }, [communityId]);

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
    (data) => appendMessage({ ...data, createdAt: new Date(data.createdAt) })
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
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <Hash className="text-muted-foreground size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-semibold">{channelName}</span>
        <MemberAvatarStack members={members} />
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
                <div className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {formatRelativeTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <ChannelComposer channelId={channelId} onSent={appendMessage} />
    </div>
  );
}
