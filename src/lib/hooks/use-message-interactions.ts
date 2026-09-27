"use client";

import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { applyReactionEvent, type ReactableItem } from "@/lib/reactions";
import type { ComposerReplyTarget } from "@/components/messages/composer-reply-banner";

interface InteractiveMessage extends ReactableItem {
  senderId: string;
  body: string;
}

interface UseMessageInteractionsOptions<T extends InteractiveMessage> {
  messages: T[];
  viewerId: string;
  setMessages: Dispatch<SetStateAction<T[]>>;
  listRef: RefObject<HTMLElement | null>;
  toggleReaction: (messageId: string, emoji: string) => Promise<unknown>;
  resolveSenderName: (senderId: string) => string;
}

/**
 * Reply/quote/reaction handling shared between the DM thread and the
 * group/channel thread — the two surfaces render differently, but "react to
 * a message," "reply to a message," "quote a highlighted excerpt," and
 * "scroll to the quoted original" behave identically over whatever message
 * shape each surface uses.
 */
export function useMessageInteractions<T extends InteractiveMessage>({
  messages,
  viewerId,
  setMessages,
  listRef,
  toggleReaction,
  resolveSenderName,
}: UseMessageInteractionsOptions<T>) {
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);

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

  function handleReply(message: T) {
    setReplyTarget({ messageId: message.id, senderName: resolveSenderName(message.senderId), excerpt: message.body.slice(0, 120) });
  }

  function handleQuote(messageId: string, excerpt: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    setReplyTarget({ messageId, senderName: resolveSenderName(message.senderId), excerpt });
  }

  function scrollToMessage(messageId: string) {
    listRef.current?.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return { replyTarget, setReplyTarget, handleToggleReaction, handleReply, handleQuote, scrollToMessage };
}
