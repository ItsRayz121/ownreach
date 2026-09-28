"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Eye, Settings, Reply, Pencil } from "lucide-react";
import { RichText } from "@/components/post/rich-text";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markCommunityRead,
  loadOlderChannelMessages,
  viewChannelMessages,
  toggleChannelMessageReaction,
  deleteChannelMessageMedia,
} from "@/lib/actions/communities";
import { votePoll } from "@/lib/actions/polls";
import { applyReactionEvent } from "@/lib/reactions";
import { applyPollVoteEvent } from "@/lib/poll-votes";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { useMessageInteractions } from "@/lib/hooks/use-message-interactions";
import { MemberAvatarStack } from "./member-avatar-stack";
import { ChannelComposer } from "./channel-composer";
import { MessageReactions } from "@/components/messages/message-reactions";
import { MessageStatusTicks, type MessageStatus } from "@/components/messages/message-status-ticks";
import { QuoteSelectionPopup } from "@/components/messages/quote-selection-popup";
import { ReplyPreview } from "@/components/messages/reply-preview";
import { ContactMessageCard } from "@/components/messages/contact-message-card";
import { PollMessageCard } from "@/components/messages/poll-message-card";
import { MediaMessageCard } from "@/components/messages/media-message-card";
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
    return senderMap.get(senderId)?.displayName ?? "Member";
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
    toggleReaction: toggleChannelMessageReaction,
    votePoll,
    deleteMedia: deleteChannelMessageMedia,
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

  function appendMessage(message: ChannelMessageItem) {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  useAblyChannel<{
    id: string;
    body: string;
    senderId: string;
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

      <div ref={listRef} className="relative flex-1 space-y-2 overflow-y-auto px-4 py-4">
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
          const sender = senderMap.get(m.senderId);
          const editable = mine && !m.poll && !m.sharedContact;
          return (
            <div key={m.id} data-message-id={m.id} className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <UserAvatar src={sender?.avatarUrl} name={sender?.displayName ?? "Member"} className="size-7 shrink-0" />}
              <div className="flex items-end gap-1">
                {!mine && canPost && (
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
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                      (m.poll || m.sharedContact || m.media) && "px-2 py-1.5"
                    )}
                  >
                    {!mine && <p className="mb-0.5 text-xs font-medium opacity-80">{sender?.displayName ?? "Member"}</p>}
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
                          onDelete={(mine || canManage) && !m.media.removed ? () => handleDeleteMedia(m.id) : undefined}
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
                        "mt-0.5 flex items-center gap-2 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      <span>{formatRelativeTime(m.createdAt)}</span>
                      {m.editedAt && <span>· edited</span>}
                      {showViews && mine && (
                        <span className="flex items-center gap-0.5" title={`${m.viewCount} view${m.viewCount === 1 ? "" : "s"}`}>
                          <Eye className="size-2.5" />
                          {m.viewCount}
                        </span>
                      )}
                      {kind === "group" && mine && <MessageStatusTicks status={tickStatus(m)} />}
                    </div>
                  </div>
                  <MessageReactions reactions={m.reactions} viewerId={viewerId} onToggle={(emoji) => handleToggleReaction(m.id, emoji)} mine={mine} />
                </div>
                {mine && canPost && (
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

      {canPost ? (
        <ChannelComposer
          channelId={channelId}
          onSent={appendMessage}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          editTarget={editTarget}
          onCancelEdit={() => setEditTarget(null)}
          onEdited={handleEdited}
        />
      ) : (
        <div className="text-muted-foreground border-t px-4 py-3 text-center text-sm">
          Only admins can post in this channel.
        </div>
      )}
    </div>
  );
}
