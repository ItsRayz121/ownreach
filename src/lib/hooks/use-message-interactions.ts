"use client";

import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { richTextToPlain } from "@/components/post/rich-text";
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
  createdAt: Date;
  body: string;
  editedAt: Date | null;
  poll?: { id: string; question: string; allowMultiple: boolean; options: InteractivePollOption[] } | null;
  sharedContact?: { displayName: string } | null;
  media?: { url: string | null; width: number | null; height: number | null; removed: boolean } | null;
}

function excerptFor(message: InteractiveMessage): string {
  if (message.poll) return `📊 ${message.poll.question}`;
  if (message.sharedContact) return `👤 ${message.sharedContact.displayName}`;
  if (message.media && !message.media.removed) return message.body ? `📷 ${message.body}` : "📷 Photo";
  return message.body.slice(0, 120);
}

interface UseMessageInteractionsOptions<T extends InteractiveMessage> {
  messages: T[];
  viewerId: string;
  setMessages: Dispatch<SetStateAction<T[]>>;
  listRef: RefObject<HTMLElement | null>;
  toggleReaction: (messageId: string, emoji: string) => Promise<unknown>;
  votePoll: (pollId: string, optionId: string, clientId: string) => Promise<{ added: string[]; removed: string[] }>;
  deleteMedia: (messageId: string) => Promise<unknown>;
  deleteMessage: (messageId: string) => Promise<unknown>;
  resolveSenderName: (senderId: string) => string;
}

/**
 * Reply/quote/reaction/edit/delete/copy/poll-vote handling shared between the
 * DM thread and the group/channel thread — the two surfaces render
 * differently, but these behave identically over whatever message shape each
 * surface uses. Reply and edit are mutually exclusive (starting one clears
 * the other).
 */
export function useMessageInteractions<T extends InteractiveMessage>({
  messages,
  viewerId,
  setMessages,
  listRef,
  toggleReaction,
  votePoll,
  deleteMedia,
  deleteMessage,
  resolveSenderName,
}: UseMessageInteractionsOptions<T>) {
  const [replyTarget, setReplyTarget] = useState<ComposerReplyTarget | null>(null);
  const [editTarget, setEditTarget] = useState<ComposerEditTarget | null>(null);
  // Which message the long-press/right-click menu is for. Holds the id, not
  // the message, so the menu always reads the live (reactions, edits) copy;
  // the id outlives `menuOpen` so the sheet keeps its content while it
  // animates closed.
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Identifies this tab's votes in the realtime "poll-vote" echo, so only the
  // exact tab that cast a vote skips re-applying it — a second open tab for
  // the same account still needs the broadcast (see handleVote/thread's
  // useAblyChannel subscriber). State (with a lazy initializer), not a ref —
  // its value is read during render (returned below), which refs can't do.
  const [clientId] = useState<string>(() => crypto.randomUUID());

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

    const guessAdded = option.votedByMe ? [] : [optionId];
    const guessRemoved = option.votedByMe
      ? [optionId]
      : message.poll.allowMultiple
        ? []
        : message.poll.options.filter((o) => o.votedByMe).map((o) => o.id);

    setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added: guessAdded, removed: guessRemoved }));
    votePoll(pollId, optionId, clientId)
      .then(({ added, removed }) => {
        // Reconciles the optimistic guess against what the server actually
        // applied — under a race (e.g. a double-click serialized by the
        // server's lock) the real delta can differ from the guess, and this
        // tab's realtime echo is intentionally skipped (see thread's
        // useAblyChannel poll-vote handler), so nothing else corrects it.
        setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added: guessRemoved, removed: guessAdded }));
        setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added, removed }));
      })
      .catch((error) => {
        setMessages((prev) => applyPollVoteEvent(prev, { pollId, userId: viewerId, viewerId, added: guessRemoved, removed: guessAdded }));
        toast.error(error instanceof Error ? error.message : "Couldn't vote on that poll.");
      });
  }

  async function handleCopy(message: T) {
    const text = richTextToPlain(message.body).trim();
    if (!text) return;
    if (await copyToClipboard(text)) toast.success("Copied");
    else toast.error("Couldn't copy that message.");
  }

  function openMenu(messageId: string) {
    setMenuMessageId(messageId);
    setMenuOpen(true);
  }

  // Removes a message from the local list (own delete, or the realtime echo of
  // someone else's) and drops any reply/edit draft that pointed at it.
  function removeMessageLocally(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setReplyTarget((target) => (target?.messageId === messageId ? null : target));
    setEditTarget((target) => (target?.id === messageId ? null : target));
    if (messageId === menuMessageId) setMenuOpen(false);
  }

  function handleDelete(messageId: string) {
    const removed = messages.find((m) => m.id === messageId);
    if (!removed) return;
    removeMessageLocally(messageId);
    deleteMessage(messageId).catch((error) => {
      // Put it back where it belongs (by time, since older pages may have
      // loaded in the meantime) rather than restoring a stale snapshot.
      setMessages((prev) =>
        prev.some((m) => m.id === messageId) ? prev : [...prev, removed].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      );
      toast.error(error instanceof Error ? error.message : "Couldn't delete that message.");
    });
  }

  function scrollToMessage(messageId: string) {
    listRef.current?.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleDeleteMedia(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message?.media) return;
    const previousMedia = message.media;

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, media: { url: null, width: null, height: null, removed: true } } : m)));
    deleteMedia(messageId).catch((error) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, media: previousMedia } : m)));
      toast.error(error instanceof Error ? error.message : "Couldn't delete that photo.");
    });
  }

  return {
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
  };
}
