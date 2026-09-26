"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { RichText } from "@/components/post/rich-text";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markConversationRead, loadOlderMessages } from "@/lib/actions/messages";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { MessageComposer } from "./message-composer";
import type { MessageItem } from "@/lib/data/messages";

interface OtherParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MessageThreadProps {
  conversationId: string;
  viewerId: string;
  other: OtherParticipant | null;
  initialMessages: MessageItem[];
  initialNextCursor: string | null;
}

export function MessageThread({ conversationId, viewerId, other, initialMessages, initialNextCursor }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  function appendMessage(message: MessageItem) {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  // The sender's own tab also receives this via the realtime subscription
  // below (the publish is server-side, so there's no "don't echo to sender"
  // built in) — appendMessage dedupes by id either way.
  useAblyChannel<{ id: string; body: string; senderId: string; createdAt: string }>(
    `conversation:${conversationId}`,
    "message",
    (data) => appendMessage({ ...data, createdAt: new Date(data.createdAt) })
  );

  function handleLoadOlder() {
    if (!nextCursor) return;
    startLoadOlder(async () => {
      const { items, nextCursor: newCursor } = await loadOlderMessages(conversationId, nextCursor);
      setMessages((prev) => [...items, ...prev]);
      setNextCursor(newCursor);
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-[calc(100dvh-1px)]">
      <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <Link href="/messages" className="text-muted-foreground hover:text-foreground md:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <Link href={`/${other.username}`} className="flex items-center gap-2.5">
            <UserAvatar src={other.avatarUrl} name={other.displayName} className="size-8" />
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{other.displayName}</span>
              <span className="text-muted-foreground text-xs">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <span className="font-semibold">Unknown user</span>
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
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
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

      <MessageComposer conversationId={conversationId} onSent={appendMessage} />
    </div>
  );
}
