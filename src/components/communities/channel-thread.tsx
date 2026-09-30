"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Eye, Settings } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import {
  markCommunityRead,
  loadOlderChannelMessages,
  viewChannelMessages,
  toggleChannelMessageReaction,
  deleteChannelMessage,
  deleteChannelMessageMedia,
} from "@/lib/actions/communities";
import { votePoll } from "@/lib/actions/polls";
import { isWithinEditWindow } from "@/lib/message-edit";
import { CHANNEL_SENDER_ID } from "@/lib/community-roles";
import { applyReactionEvent } from "@/lib/reactions";
import { applyPollVoteEvent } from "@/lib/poll-votes";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { useMessageInteractions } from "@/lib/hooks/use-message-interactions";
import { MemberAvatarStack } from "./member-avatar-stack";
import { ChannelComposer } from "./channel-composer";
import { ChatViewport } from "@/components/messages/chat-viewport";
import { MessageBubble } from "@/components/messages/message-bubble";
import { ForwardSheet } from "@/components/messages/forward-sheet";
import { MessageActionsSheet, type MessageActions } from "@/components/messages/message-actions-sheet";
import { MessagePressTarget } from "@/components/messages/message-press-target";
import { MessageReactions } from "@/components/messages/message-reactions";
import { MessageStatusTicks, type MessageStatus } from "@/components/messages/message-status-ticks";
import { QuoteSelectionPopup } from "@/components/messages/quote-selection-popup";
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
  memberCount: number;
  canManage: boolean;
  canPost: boolean;
  kind: "group" | "channel";
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
  memberCount,
  canManage,
  canPost,
  kind,
  showViews,
  initialMessages,
  initialNextCursor,
}: ChannelThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingOlder, startLoadOlder] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const viewedRef = useRef(new Set<string>());
  const senderMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  function senderName(senderId: string) {
    if (senderId === viewerId) return "You";
    if (senderId === CHANNEL_SENDER_ID) return channelName;
    return senderMap.get(senderId)?.displayName ?? "Member";
  }

  const {
    replyTarget,
    setReplyTarget,
    editTarget,
    setEditTarget,
    menuMessageId,
    menuOpen,
    setMenuOpen,
    forwardBody,
    setForwardBody,
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
    toggleReaction: toggleChannelMessageReaction,
    votePoll,
    deleteMedia: deleteChannelMessageMedia,
    deleteMessage: deleteChannelMessage,
    resolveSenderName: senderName,
  });

  useEffect(() => {
    markCommunityRead(communityId).catch(() => {});
  }, [communityId]);

  // Tracked for both kinds now — channels render it as an eye-icon view
  // count, groups compare it against memberCount for WhatsApp-style ticks.
  useEffect(() => {
    const unseen = messages.filter((m) => m.senderId !== viewerId && !viewedRef.current.has(m.id)).map((m) => m.id);
    if (unseen.length === 0) return;
    unseen.forEach((id) => viewedRef.current.add(id));
    viewChannelMessages(channelId, unseen).catch(() => {});
  }, [messages, channelId, viewerId]);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // `authoritative` is the sender's own server response: it carries the real
  // author, so it replaces a realtime echo that arrived first with the
  // channel-identity stand-in id (which would otherwise hide edit rights).
  function appendMessage(message: ChannelMessageItem, authoritative = false) {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? (authoritative ? prev.map((m) => (m.id === message.id ? { ...m, senderId: message.senderId } : m)) : prev) : [...prev, message]
    );
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  useAblyChannel<{
    id: string;
    body: string;
    senderId: string;
    postedAsChannel?: boolean;
    createdAt: string;
    replyToMessageId: string | null;
    replyExcerpt: string | null;
    sharedContact?: ChannelMessageItem["sharedContact"];
    poll?: ChannelMessageItem["poll"];
    media?: ChannelMessageItem["media"];
  }>(`channel:${channelId}`, "message", (data) => {
    const replyToSource = data.replyToMessageId ? messages.find((m) => m.id === data.replyToMessageId) : undefined;
    appendMessage({
      ...data,
      postedAsChannel: data.postedAsChannel ?? false,
      createdAt: new Date(data.createdAt),
      editedAt: null,
      viewCount: 0,
      replyTo: replyToSource ? { id: replyToSource.id, body: replyToSource.body, senderId: replyToSource.senderId } : null,
      reactions: [],
      sharedContact: data.sharedContact ?? null,
      poll: data.poll ?? null,
      media: data.media ?? null,
    });
  });

  useAblyChannel<{ messageId: string }>(`channel:${channelId}`, "media-removed", (data) => {
    setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, media: { url: null, width: null, height: null, removed: true } } : m)));
  });

  useAblyChannel<{ messageId: string }>(`channel:${channelId}`, "deleted", (data) => removeMessageLocally(data.messageId));

  useAblyChannel<{ messageId: string; userId: string; emoji: string; action: "added" | "removed" }>(
    `channel:${channelId}`,
    "reaction",
    (data) => setMessages((prev) => applyReactionEvent(prev, data))
  );

  useAblyChannel<{ messageId: string; body: string; editedAt: string }>(`channel:${channelId}`, "edited", (data) => {
    setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, body: data.body, editedAt: new Date(data.editedAt) } : m)));
  });

  // This exact tab's own votes are already applied (and reconciled) in
  // handleVote — skip only this tab's echo (by clientId, not userId) so
  // another open tab/device for the same account still gets the update.
  useAblyChannel<{ pollId: string; userId: string; clientId?: string; added: string[]; removed: string[] }>(
    `channel:${channelId}`,
    "poll-vote",
    (data) => {
      if (data.clientId === clientId) return;
      setMessages((prev) => applyPollVoteEvent(prev, { ...data, viewerId }));
    }
  );

  function handleLoadOlder() {
    if (!nextCursor) return;
    startLoadOlder(async () => {
      const { items, nextCursor: newCursor } = await loadOlderChannelMessages(channelId, nextCursor);
      setMessages((prev) => [...items, ...prev]);
      setNextCursor(newCursor);
    });
  }

  function tickStatus(m: ChannelMessageItem): MessageStatus {
    const othersCount = Math.max(0, memberCount - 1);
    if (othersCount === 0 || m.viewCount === 0) return "sent";
    if (m.viewCount >= othersCount) return "read";
    return "delivered";
  }

  // Mirrors the server: authors edit their own messages (groups within the
  // edit window; broadcast-channel admins any time), and the author or a
  // community manager can delete.
  function actionsFor(m: ChannelMessageItem): MessageActions {
    const mine = m.senderId === viewerId;
    const editable = mine && canPost && !m.poll && !m.sharedContact && (kind === "channel" || isWithinEditWindow(m.createdAt));
    return {
      activeEmoji: m.reactions.find((r) => r.userId === viewerId)?.emoji ?? null,
      onReact: (emoji) => handleToggleReaction(m.id, emoji),
      onReply: canPost ? () => startReply(m) : undefined,
      onCopy: m.body.trim() ? () => void handleCopy(m) : undefined,
      onForward: m.body.trim() && !m.poll && !m.sharedContact && !m.media ? () => setForwardBody(m.body) : undefined,
      onEdit: editable ? () => handleEdit(m) : undefined,
      onDelete: mine || canManage ? () => handleDelete(m.id) : undefined,
    };
  }

  const menuMessage = menuMessageId ? messages.find((m) => m.id === menuMessageId) : undefined;

  return (
    <ChatViewport>
      <header className="flex shrink-0 items-center gap-1 border-b px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 md:px-4 md:pt-2">
        <Link
          href={`/communities?kind=${kind}`}
          aria-label={kind === "channel" ? "Back to channels" : "Back to groups"}
          className="hover:bg-accent/60 flex size-10 shrink-0 items-center justify-center rounded-full md:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pr-1">
          <UserAvatar src={avatarUrl} name={channelName} className="size-10 shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold">{channelName}</span>
            <span className="text-muted-foreground truncate text-xs">
              @{communitySlug} · {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </span>
        </div>
        <span className="hidden sm:block">
          <MemberAvatarStack members={members} />
        </span>
        {canManage && (
          <Link
            href={`/communities/${communitySlug}/settings`}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex size-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Community settings"
          >
            <Settings className="size-5" />
          </Link>
        )}
      </header>

      <div ref={listRef} data-chat-list className="relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
        {canPost && <QuoteSelectionPopup containerRef={listRef} onQuote={handleQuote} />}
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
          // Channel-identity posts read as the channel's, even to the admin who wrote them.
          const asChannel = m.postedAsChannel;
          const alignRight = mine && !asChannel;
          const sender = asChannel ? { displayName: channelName, avatarUrl } : senderMap.get(m.senderId);
          return (
            <div key={m.id} data-message-id={m.id} className={cn("flex items-end gap-2", alignRight ? "justify-end" : "justify-start")}>
              {!alignRight && <UserAvatar src={sender?.avatarUrl} name={sender?.displayName ?? "Member"} className="size-7 shrink-0" />}
              <MessagePressTarget
                mine={alignRight}
                onOpenMenu={() => openMenu(m.id)}
                // The row also holds the avatar, so its share of the width is
                // taken off the cap — bubbles then line up with DMs.
                className={cn("min-w-0", alignRight ? "max-w-[88%] md:max-w-[75%]" : "max-w-[calc(88%-2.5rem)] md:max-w-[calc(75%-2.5rem)]")}
              >
                <MessageBubble
                  message={m}
                  mine={alignRight}
                  senderLabel={alignRight ? undefined : (sender?.displayName ?? "Member")}
                  replySenderName={m.replyTo ? senderName(m.replyTo.senderId) : undefined}
                  onJumpToReply={() => m.replyToMessageId && scrollToMessage(m.replyToMessageId)}
                  onVote={m.poll ? (optionId) => handleVote(m.poll!.id, optionId) : undefined}
                  onDeleteMedia={(mine || canManage) && m.media && !m.media.removed ? () => handleDeleteMedia(m.id) : undefined}
                  meta={
                    <>
                      {showViews && mine && (
                        <span className="flex items-center gap-0.5" title={`${m.viewCount} view${m.viewCount === 1 ? "" : "s"}`}>
                          <Eye className="size-2.5" />
                          {m.viewCount}
                        </span>
                      )}
                      {kind === "group" && mine && <MessageStatusTicks status={tickStatus(m)} />}
                    </>
                  }
                />
                <MessageReactions reactions={m.reactions} viewerId={viewerId} onToggle={(emoji) => handleToggleReaction(m.id, emoji)} mine={alignRight} />
              </MessagePressTarget>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <ChannelComposer
          channelId={channelId}
          onSent={(message) => appendMessage(message, true)}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          editTarget={editTarget}
          onCancelEdit={() => setEditTarget(null)}
          onEdited={handleEdited}
        />
      ) : (
        <div className="text-muted-foreground shrink-0 border-t px-4 py-3 text-center text-sm">Only admins can post in this channel.</div>
      )}

      <MessageActionsSheet open={menuOpen && Boolean(menuMessage)} onOpenChange={setMenuOpen} actions={menuMessage ? actionsFor(menuMessage) : {}} />
      <ForwardSheet body={forwardBody} onClose={() => setForwardBody(null)} />
    </ChatViewport>
  );
}
