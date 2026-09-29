"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  markConversationRead,
  loadOlderMessages,
  markMessagesDelivered,
  toggleMessageReaction,
  deleteMessage,
  deleteMessageMedia,
  acceptMessageRequest,
  declineMessageRequest,
} from "@/lib/actions/messages";
import { votePoll } from "@/lib/actions/polls";
import { MESSAGE_REQUEST_CAP } from "@/lib/message-requests";
import { isWithinEditWindow } from "@/lib/message-edit";
import { applyReactionEvent } from "@/lib/reactions";
import { applyPollVoteEvent } from "@/lib/poll-votes";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { useMessageInteractions } from "@/lib/hooks/use-message-interactions";
import { ChatViewport } from "./chat-viewport";
import { MessageComposer } from "./message-composer";
import { MessageBubble } from "./message-bubble";
import { MessageActionsSheet, type MessageActions } from "./message-actions-sheet";
import { MessagePressTarget } from "./message-press-target";
import { MessageReactions } from "./message-reactions";
import { MessageStatusTicks, type MessageStatus } from "./message-status-ticks";
import { QuoteSelectionPopup } from "./quote-selection-popup";
import type { ComposerReplyTarget } from "./composer-reply-banner";
import type { PendingAttachment } from "@/components/composer/composer-base";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
    menuMessageId,
    menuOpen,
    setMenuOpen,
    openMenu,
    clientId,
    handleToggleReaction,
    startReply,
    handleQuote,
    handleEdit,
    handleEdited,
    handleVote,
    handleDeleteMedia,
    handleCopy,
    handleDelete,
    removeMessageLocally,
    scrollToMessage,
  } = useMessageInteractions({
    messages,
    viewerId,
    setMessages,
    listRef,
    toggleReaction: toggleMessageReaction,
    votePoll,
    deleteMedia: deleteMessageMedia,
    deleteMessage,
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

  useAblyChannel<{ messageId: string }>(`conversation:${conversationId}`, "deleted", (data) => removeMessageLocally(data.messageId));

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

  // Only what this viewer is actually allowed to do with the message, so the
  // sheet never shows a button that would just fail.
  function actionsFor(m: ThreadMessage): MessageActions {
    const mine = m.senderId === viewerId;
    const editable = mine && !composerDisabled && !m.poll && !m.sharedContact && isWithinEditWindow(m.createdAt);
    return {
      activeEmoji: m.reactions.find((r) => r.userId === viewerId)?.emoji ?? null,
      onReact: (emoji) => handleToggleReaction(m.id, emoji),
      onReply: composerDisabled ? undefined : () => startReply(m),
      onCopy: m.body.trim() ? () => void handleCopy(m) : undefined,
      onEdit: editable ? () => handleEdit(m) : undefined,
      onDelete: mine ? () => handleDelete(m.id) : undefined,
    };
  }

  const menuMessage = menuMessageId ? messages.find((m) => m.id === menuMessageId) : undefined;

  return (
    <ChatViewport>
      <header className="flex shrink-0 items-center gap-1 border-b px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 md:px-4 md:pt-2">
        <Link
          href="/messages"
          aria-label="Back to chats"
          className="hover:bg-accent/60 flex size-10 shrink-0 items-center justify-center rounded-full md:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <Link href={`/${other.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pr-2">
            <UserAvatar src={other.avatarUrl} name={other.displayName} className="size-10 shrink-0" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[15px] font-semibold">{other.displayName}</span>
              <span className="text-muted-foreground truncate text-xs">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <span className="px-2 font-semibold">Unknown user</span>
        )}
      </header>

      {requestStatus === "pending" && !isInitiator && (
        <div className="bg-accent/40 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 text-sm">
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
        <div className="text-muted-foreground shrink-0 border-b px-4 py-2 text-center text-xs">
          Message request sent · {initiatorSentCount}/{MESSAGE_REQUEST_CAP} messages used until they accept
        </div>
      )}

      <div ref={listRef} data-chat-list className="relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
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
            <div key={m.id} data-message-id={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <MessagePressTarget mine={mine} disabled={m.pending} onOpenMenu={() => openMenu(m.id)} className="max-w-[88%] min-w-0 md:max-w-[75%]">
                <MessageBubble
                  message={m}
                  mine={mine}
                  replySenderName={m.replyTo ? senderName(m.replyTo.senderId) : undefined}
                  onJumpToReply={() => m.replyToMessageId && scrollToMessage(m.replyToMessageId)}
                  onVote={m.poll ? (optionId) => handleVote(m.poll!.id, optionId) : undefined}
                  onDeleteMedia={mine && m.media && !m.media.removed ? () => handleDeleteMedia(m.id) : undefined}
                  meta={mine && <MessageStatusTicks status={tickStatus(m)} />}
                />
                <MessageReactions reactions={m.reactions} viewerId={viewerId} onToggle={(emoji) => handleToggleReaction(m.id, emoji)} mine={mine} />
              </MessagePressTarget>
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

      <MessageActionsSheet open={menuOpen && Boolean(menuMessage)} onOpenChange={setMenuOpen} actions={menuMessage ? actionsFor(menuMessage) : {}} />
    </ChatViewport>
  );
}
