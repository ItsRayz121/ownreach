"use client";

import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { applyReactionEvent, type ReactableItem } from "@/lib/reactions";
import { applyPollVoteEvent } from "@/lib/poll-votes";
import type { ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import type { ComposerEditTarget } from "@/components/composer/composer-base";

interface InteractivePollOption {
  id: string;
  text: string;
  voteCount: number;
  votedByMe: boolean;
}

interface InteractiveMessage extends ReactableItem {
  senderId: string;
  body: string;
  editedAt: Date | null;
  poll?: { id: string; question: string; allowMultiple: boolean; options: InteractivePollOption[] } | null;
  sharedContact?: { displayName: string } | null;
}

function excerptFor(message: InteractiveMessage): string {
  if (message.poll) return `📊 ${message.poll.question}`;
  if (message.sharedContact) return `👤 ${message.sharedContact.displayName}`;
  return message.body.slice(0, 120);
}

interface UseMessageInteractionsOptions<T extends InteractiveMessage> {
  messages: T[];
  viewerId: string;
  setMessages: Dispatch<SetStateAction<T[]>>;
  listRef: RefObject<HTMLElement | null>;
  toggleReaction: (messageId: string, emoji: string) => Promise<unknown>;
  votePoll: (pollId: string, optionId: string) => Promise<unknown>;
  resolveSenderName: (senderId: string) => string;
}

/**
 * Reply/quote/reaction/edit/poll-vote handling shared between the DM thread
 * and the group/channel thread — the two surfaces render differently, but
 * these behave identically over whatever message shape each surface uses.
 * Reply and edit are mutually exclusive (starting one clears the other).
 */
export function useMessageInteractions<T extends InteractiveMessage>({
  messages,
  viewerId,
  setMessages,
  listRef,
  toggleReaction,
  votePoll,
  resolveSenderName,
}: UseMessageInteractionsOptions<T>) {
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [editTarget, setEditTarget] = useState<ComposerEditTarget | null>(null);

  function handleToggleReaction(messageId: string, emoji: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    const mine = message.reactions.find((r) => r.userId === viewerId);
    const action: "added" | "removed" = mine?.emoji === emoji ? "removed" : "added";

    setMessages((prev) => applyReactionEvent(prev, { messageId, userId: viewerId, emoji, action }));
    toggleReaction(messageId, emoji).catch((error) => {
      // Undo only the viewer's own reaction rather than restoring the whole
      // pre-update snapshot — another user's reaction could have arrived via
      // realtime in the meantime, and that shouldn't be clobbered.
      setMessages((prev) =>
        applyReactionEvent(
          prev,
          mine ? { messageId, userId: viewerId, emoji: mine.emoji, action: "added" } : { messageId, userId: viewerId, emoji, action: "removed" }
        )
      );
      toast.error(error instanceof Error ? error.message : "Couldn't react to that message.");
    });
  }

  function startReply(message: T) {
    setEditTarget(null);
    setReplyTarget({ messageId: message.id, senderName: resolveSenderName(message.senderId), excerpt: excerptFor(message) });
  }

  function handleQuote(messageId: string, excerpt: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    setEditTarget(null);
    setReplyTarget({ messageId, senderName: resolveSenderName(message.senderId), excerpt });
  }

  function handleEdit(message: T) {
    setReplyTarget(null);
    setEditTarget({ id: message.id, body: message.body });
  }

  function handleEdited(messageId: string, body: string, editedAt: Date) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, body, editedAt } : m)));
  }

  function handleVote(pollId: string, optionId: string) {
    const message = messages.find((m) => m.poll?.id === pollId);
    const option = message?.poll?.options.find((o) => o.id === optionId);
    if (!message?.poll || !option) return;

    const added = option.votedByMe ? [] : [optionId];
    const removed = option.votedByMe ? [optionId] : message.poll.allowMultiple ? [] : message.poll.options.filter((o) => o.votedByMe).map((o) => o.id);

    setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added, removed }));
    votePoll(pollId, optionId).catch((error) => {
      setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added: removed, removed: added }));
      toast.error(error instanceof Error ? error.message : "Couldn't vote on that poll.");
    });
  }

  function scrollToMessage(messageId: string) {
    listRef.current?.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return {
    replyTarget,
    setReplyTarget,
    editTarget,
    setEditTarget,
    handleToggleReaction,
    startReply,
    handleQuote,
    handleEdit,
    handleEdited,
    handleVote,
    scrollToMessage,
  };
}
