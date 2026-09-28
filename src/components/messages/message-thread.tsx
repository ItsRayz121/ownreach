"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Reply, Pencil } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { RichText } from "@/components/post/rich-text";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markConversationRead,
  loadOlderMessages,
  markMessagesDelivered,
  toggleMessageReaction,
  deleteMessageMedia,
  acceptMessageRequest,
  declineMessageRequest,
} from "@/lib/actions/messages";
import { votePoll } from "@/lib/actions/polls";
import { MESSAGE_REQUEST_CAP } from "@/lib/message-requests";
import { applyReactionEvent } from "@/lib/reactions";
import { applyPollVoteEvent } from "@/lib/poll-votes";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { useMessageInteractions } from "@/lib/hooks/use-message-interactions";
import { MessageComposer } from "./message-composer";
import { MessageReactions } from "./message-reactions";
import { MessageStatusTicks, type MessageStatus } from "./message-status-ticks";
import { QuoteSelectionPopup } from "./quote-selection-popup";
import { ReplyPreview } from "./reply-preview";
import { ContactMessageCard } from "./contact-message-card";
import { PollMessageCard } from "./poll-message-card";
import { MediaMessageCard } from "./media-message-card";
import type { ComposerReplyTarget } from "./composer-reply-banner";
import type { PendingAttachment } from "@/components/composer/composer-base";
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

  const {
    replyTarget,
    setReplyTarget,
    editTarget,
    setEditTarget,
    clientId,
    handleToggleReaction,
    startReply,
    handleQuote,
    handleEdit,
    handleEdited,
    handleVote,
    handleDeleteMedia,
    scrollToMessage,
  } = useMessageInteractions({
    messages,
    viewerId,
    setMessages,
    listRef,
    toggleReaction: toggleMessageReaction,
    votePoll,
    deleteMedia: deleteMessageMedia,
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

  function handleOptimisticSend(tempId: string, body: string, target: ComposerReplyTarget | null, attachment: PendingAttachment | null) {
    const replyToSource = target ? messages.find((m) => m.id === target.messageId) : undefined;
    const optimistic: ThreadMessage = {
      id: tempId,
      body,
      createdAt: new Date(),
      senderId: viewerId,
      deliveredAt: null,
      editedAt: null,
      replyToMessageId: target?.messageId ?? null,
      replyExcerpt: target?.excerpt ?? null,
      replyTo: replyToSource ? { id: replyToSource.id, body: replyToSource.body, senderId: replyToSource.senderId } : null,
      reactions: [],
      sharedContact: null,
      poll: null,
      media: attachment ? { url: attachment.url, width: attachment.width, height: attachment.height, removed: false } : null,
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
    sharedContact?: MessageItem["sharedContact"];
    poll?: MessageItem["poll"];
    media?: MessageItem["media"];
  }>(`conversation:${conversationId}`, "message", (data) => {
    const replyToSource = data.replyToMessageId ? messages.find((m) => m.id === data.replyToMessageId) : undefined;
    appendMessage({
      ...data,
      createdAt: new Date(data.createdAt),
      deliveredAt: null,
      editedAt: null,
      replyTo: replyToSource ? { id: replyToSource.id, body: replyToSource.body, senderId: replyToSource.senderId } : null,
      reactions: [],
      sharedContact: data.sharedContact ?? null,
      poll: data.poll ?? null,
      media: data.media ?? null,
    });
    markMessagesDelivered(conversationId).catch(() => {});
  });

  useAblyChannel<{ messageId: string }>(`conversation:${conversationId}`, "media-removed", (data) => {
    setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, media: { url: null, width: null, height: null, removed: true } } : m)));
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

  useAblyChannel<{ messageId: string; body: string; editedAt: string }>(`conversation:${conversationId}`, "edited", (data) => {
    setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, body: data.body, editedAt: new Date(data.editedAt) } : m)));
  });

  // This exact tab's own votes are already applied (and reconciled) in
  // handleVote — skip only this tab's echo (by clientId, not userId) so
  // another open tab/device for the same account still gets the update.
  useAblyChannel<{ pollId: string; userId: string; clientId?: string; added: string[]; removed: string[] }>(
    `conversation:${conversationId}`,
    "poll-vote",
    (data) => {
      if (data.clientId === clientId) return;
      setMessages((prev) => applyPollVoteEvent(prev, { ...data, viewerId }));
    }
  );

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
          const editable = mine && !m.poll && !m.sharedContact && !m.pending;
          return (
            <div key={m.id} data-message-id={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[75%] items-end gap-1">
                {!mine && !composerDisabled && (
                  <button
                    type="button"
                    onClick={() => startReply(m)}
                    aria-label="Reply"
                    className="text-muted-foreground hover:text-foreground mb-1 shrink-0 self-end opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Reply className="size-3.5" />
                  </button>
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                      (m.poll || m.sharedContact || m.media) && "px-2 py-1.5"
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
                    {m.poll ? (
                      <PollMessageCard poll={m.poll} mine={mine} onVote={(optionId) => handleVote(m.poll!.id, optionId)} />
                    ) : m.sharedContact ? (
                      <ContactMessageCard contact={m.sharedContact} mine={mine} />
                    ) : m.media ? (
                      <div className="flex flex-col gap-1.5">
                        <MediaMessageCard
                          media={m.media}
                          mine={mine}
                          onDelete={mine && !m.media.removed ? () => handleDeleteMedia(m.id) : undefined}
                        />
                        {m.body && (
                          <span onContextMenu={(e) => e.preventDefault()} style={{ WebkitTouchCallout: "none" }}>
                            <RichText text={m.body} />
                          </span>
                        )}
                      </div>
                    ) : (
                      // Suppresses the native OS text-selection menu/callout on
                      // message text only (see QuoteSelectionPopup's in-app
                      // Copy/Quote replacement) — scoped here, not on the
                      // whole list, so it doesn't also swallow right-click on
                      // poll/contact-card links elsewhere in the bubble.
                      <span onContextMenu={(e) => e.preventDefault()} style={{ WebkitTouchCallout: "none" }}>
                        <RichText text={m.body} />
                      </span>
                    )}
                    <div
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      <span>{formatRelativeTime(m.createdAt)}</span>
                      {m.editedAt && <span>· edited</span>}
                      {mine && <MessageStatusTicks status={tickStatus(m)} />}
                    </div>
                  </div>
                  <MessageReactions reactions={m.reactions} viewerId={viewerId} onToggle={(emoji) => handleToggleReaction(m.id, emoji)} mine={mine} />
                </div>
                {mine && !composerDisabled && (
                  <div className="mb-1 flex shrink-0 items-center gap-1.5 self-end opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    {editable && (
                      <button type="button" onClick={() => handleEdit(m)} aria-label="Edit" className="text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => startReply(m)} aria-label="Reply" className="text-muted-foreground hover:text-foreground">
                      <Reply className="size-3.5" />
                    </button>
                  </div>
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
        editTarget={editTarget}
        onCancelEdit={() => setEditTarget(null)}
        onEdited={handleEdited}
      />
    </div>
  );
}
