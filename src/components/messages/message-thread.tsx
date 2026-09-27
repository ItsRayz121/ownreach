"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Reply } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { RichText } from "@/components/post/rich-text";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markConversationRead,
  loadOlderMessages,
  markMessagesDelivered,
  toggleMessageReaction,
  acceptMessageRequest,
  declineMessageRequest,
} from "@/lib/actions/messages";
import { MESSAGE_REQUEST_CAP } from "@/lib/message-requests";
import { applyReactionEvent } from "@/lib/reactions";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { useMessageInteractions } from "@/lib/hooks/use-message-interactions";
import { MessageComposer } from "./message-composer";
import { MessageReactions } from "./message-reactions";
import { MessageStatusTicks, type MessageStatus } from "./message-status-ticks";
import { QuoteSelectionPopup } from "./quote-selection-popup";
import { ReplyPreview } from "./reply-preview";
import type { ComposerReplyTarget } from "./composer-reply-banner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MessageItem } from "@/lib/data/messages";

interface OtherParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastReadAt: Date | null;
}

type ThreadMessage = MessageItem & { pending?: boolean };

interface MessageThreadProps {
  conversationId: string;
  viewerId: string;
  other: OtherParticipant | null;
  initialMessages: MessageItem[];
  initialNextCursor: string | null;
  status: "accepted" | "pending" | "declined";
  initiatorId: string | null;
}

export function MessageThread({ conversationId, viewerId, other, initialMessages, initialNextCursor, status, initiatorId }: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  const [otherLastReadAt, setOtherLastReadAt] = useState<Date | null>(other?.lastReadAt ?? null);
  const [requestStatus, setRequestStatus] = useState(status);
  const [isRequestPending, startRequestTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  function senderName(senderId: string) {
    return senderId === viewerId ? "You" : (other?.displayName ?? "them");
  }

  const { replyTarget, setReplyTarget, handleToggleReaction, handleReply, handleQuote, scrollToMessage } = useMessageInteractions({
    messages,
    viewerId,
    setMessages,
    listRef,
    toggleReaction: toggleMessageReaction,
    resolveSenderName: senderName,
  });

  useEffect(() => {
    markConversationRead(conversationId).catch(() => {});
    markMessagesDelivered(conversationId).catch(() => {});
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

  function handleOptimisticSend(tempId: string, body: string, target: ComposerReplyTarget | null) {
    const replyToSource = target ? messages.find((m) => m.id === target.messageId) : undefined;
    const optimistic: ThreadMessage = {
      id: tempId,
      body,
      createdAt: new Date(),
      senderId: viewerId,
      deliveredAt: null,
      replyToMessageId: target?.messageId ?? null,
      replyExcerpt: target?.excerpt ?? null,
      replyTo: replyToSource ? { id: replyToSource.id, body: replyToSource.body, senderId: replyToSource.senderId } : null,
      reactions: [],
      pending: true,
    };
    appendMessage(optimistic);
  }

  function handleSent(message: MessageItem, tempId?: string) {
    setMessages((prev) => {
      const withoutTemp = tempId ? prev.filter((m) => m.id !== tempId) : prev;
      return withoutTemp.some((m) => m.id === message.id) ? withoutTemp : [...withoutTemp, message];
    });
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    markMessagesDelivered(conversationId).catch(() => {});
    if ((requestStatus === "pending" || requestStatus === "declined") && viewerId !== initiatorId) {
      setRequestStatus("accepted");
    }
  }

  function handleSendError(tempId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }

  // The sender's own tab also receives this via the realtime subscription
  // below (the publish is server-side, so there's no "don't echo to sender"
  // built in) — appendMessage dedupes by id either way.
  useAblyChannel<{
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
    replyToMessageId: string | null;
    replyExcerpt: string | null;
  }>(`conversation:${conversationId}`, "message", (data) => {
    const replyToSource = data.replyToMessageId ? messages.find((m) => m.id === data.replyToMessageId) : undefined;
    appendMessage({
      ...data,
      createdAt: new Date(data.createdAt),
      deliveredAt: null,
      replyTo: replyToSource ? { id: replyToSource.id, body: replyToSource.body, senderId: replyToSource.senderId } : null,
      reactions: [],
    });
    markMessagesDelivered(conversationId).catch(() => {});
  });

  useAblyChannel<{ userId: string; readAt: string }>(`conversation:${conversationId}`, "read", (data) => {
    if (data.userId !== other?.userId) return;
    setOtherLastReadAt(new Date(data.readAt));
  });

  useAblyChannel<{ messageIds: string[] }>(`conversation:${conversationId}`, "delivered", (data) => {
    setMessages((prev) => prev.map((m) => (data.messageIds.includes(m.id) ? { ...m, deliveredAt: m.deliveredAt ?? new Date() } : m)));
  });

  useAblyChannel<{ messageId: string; userId: string; emoji: string; action: "added" | "removed" }>(
    `conversation:${conversationId}`,
    "reaction",
    (data) => setMessages((prev) => applyReactionEvent(prev, data))
  );

  useAblyChannel<{ status: "accepted" | "declined" }>(`conversation:${conversationId}`, "request-status", (data) => {
    setRequestStatus(data.status);
  });

  function handleLoadOlder() {
    if (!nextCursor) return;
    startLoadOlder(async () => {
      const { items, nextCursor: newCursor } = await loadOlderMessages(conversationId, nextCursor);
      setMessages((prev) => [...items, ...prev]);
      setNextCursor(newCursor);
    });
  }

  function tickStatus(m: ThreadMessage): MessageStatus {
    if (m.pending) return "pending";
    if (!m.deliveredAt) return "sent";
    if (otherLastReadAt && m.createdAt <= otherLastReadAt) return "read";
    return "delivered";
  }

  const initiatorSentCount = messages.filter((m) => m.senderId === initiatorId).length;
  const isInitiator = viewerId === initiatorId;
  const composerDisabled =
    requestStatus === "declined"
      ? isInitiator
      : requestStatus === "pending" && isInitiator && initiatorSentCount >= MESSAGE_REQUEST_CAP;
  const composerDisabledReason =
    requestStatus === "declined" ? "This message request was declined." : "Your message request is limited until they accept.";

  return (
    <div className="flex h-full flex-col">
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

      {requestStatus === "pending" && !isInitiator && (
        <div className="bg-accent/40 flex items-center justify-between gap-2 border-b px-4 py-2.5 text-sm">
          <span>{other?.displayName ?? "This person"} wants to send you messages.</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isRequestPending}
              onClick={() =>
                startRequestTransition(async () => {
                  try {
                    await acceptMessageRequest(conversationId);
                    setRequestStatus("accepted");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Couldn't accept this request.");
                  }
                })
              }
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isRequestPending}
              onClick={() =>
                startRequestTransition(async () => {
                  try {
                    await declineMessageRequest(conversationId);
                    setRequestStatus("declined");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Couldn't decline this request.");
                  }
                })
              }
            >
              Decline
            </Button>
          </div>
        </div>
      )}
      {requestStatus === "pending" && isInitiator && (
        <div className="text-muted-foreground border-b px-4 py-2 text-center text-xs">
          Message request sent · {initiatorSentCount}/{MESSAGE_REQUEST_CAP} messages used until they accept
        </div>
      )}

      <div ref={listRef} className="relative flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!composerDisabled && <QuoteSelectionPopup containerRef={listRef} onQuote={handleQuote} />}
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
            <div key={m.id} data-message-id={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[75%] items-end gap-1">
                {!mine && !composerDisabled && (
                  <button
                    type="button"
                    onClick={() => handleReply(m)}
                    aria-label="Reply"
                    className="text-muted-foreground hover:text-foreground mb-1 shrink-0 self-end opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Reply className="size-3.5" />
                  </button>
                )}
                <div>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {m.replyTo && (
                      <ReplyPreview
                        senderName={senderName(m.replyTo.senderId)}
                        text={m.replyExcerpt ?? m.replyTo.body.slice(0, 120)}
                        mine={mine}
                        onClick={() => m.replyToMessageId && scrollToMessage(m.replyToMessageId)}
                      />
                    )}
                    <RichText text={m.body} />
                    <div
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      <span>{formatRelativeTime(m.createdAt)}</span>
                      {mine && <MessageStatusTicks status={tickStatus(m)} />}
                    </div>
                  </div>
                  <MessageReactions reactions={m.reactions} viewerId={viewerId} onToggle={(emoji) => handleToggleReaction(m.id, emoji)} mine={mine} />
                </div>
                {mine && !composerDisabled && (
                  <button
                    type="button"
                    onClick={() => handleReply(m)}
                    aria-label="Reply"
                    className="text-muted-foreground hover:text-foreground mb-1 shrink-0 self-end opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Reply className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        conversationId={conversationId}
        onSent={handleSent}
        onOptimisticSend={handleOptimisticSend}
        onSendError={handleSendError}
        disabled={composerDisabled}
        disabledReason={composerDisabledReason}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />
    </div>
  );
}
