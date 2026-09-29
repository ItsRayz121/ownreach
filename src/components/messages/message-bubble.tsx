import { RichText } from "@/components/post/rich-text";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReplyPreview } from "./reply-preview";
import { ContactMessageCard } from "./contact-message-card";
import { PollMessageCard } from "./poll-message-card";
import { MediaMessageCard } from "./media-message-card";
import type { MessageItem } from "@/lib/data/messages";

type BubbleMessage = Pick<
  MessageItem,
  "body" | "createdAt" | "editedAt" | "poll" | "sharedContact" | "media" | "replyTo" | "replyToMessageId" | "replyExcerpt"
>;

interface MessageBubbleProps {
  message: BubbleMessage;
  mine: boolean;
  /** Sender's name shown above the text — for messages from others in a group/channel. */
  senderLabel?: string;
  replySenderName?: string;
  onJumpToReply?: () => void;
  onVote?: (optionId: string) => void;
  onDeleteMedia?: () => void;
  /** Extra items in the timestamp row (view count, delivery ticks). */
  meta?: React.ReactNode;
}

// The bubble itself — shared by DMs, groups and channels. It sizes to its
// content (short messages stay compact, long ones wrap); the *maximum* width
// is set by the row that contains it, never here, so it can't collapse.
export function MessageBubble({ message, mine, senderLabel, replySenderName, onJumpToReply, onVote, onDeleteMedia, meta }: MessageBubbleProps) {
  const isCard = Boolean(message.poll || message.sharedContact || message.media);

  return (
    <div
      className={cn(
        "w-fit max-w-full rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap",
        mine ? "bg-primary text-primary-foreground [&_a]:text-primary-foreground [&_a]:underline" : "bg-muted",
        isCard && "px-2 py-1.5"
      )}
    >
      {senderLabel && <p className="mb-0.5 text-xs font-medium opacity-80">{senderLabel}</p>}
      {message.replyTo && (
        <ReplyPreview
          senderName={replySenderName ?? "Member"}
          text={message.replyExcerpt ?? message.replyTo.body.slice(0, 120)}
          mine={mine}
          onClick={onJumpToReply}
        />
      )}
      {message.poll ? (
        <PollMessageCard poll={message.poll} mine={mine} onVote={(optionId) => onVote?.(optionId)} />
      ) : message.sharedContact ? (
        <ContactMessageCard contact={message.sharedContact} mine={mine} />
      ) : message.media ? (
        <div className="flex flex-col gap-1.5">
          <MediaMessageCard media={message.media} mine={mine} onDelete={onDeleteMedia} />
          {message.body && <RichText text={message.body} />}
        </div>
      ) : (
        <RichText text={message.body} />
      )}
      <div className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
        <span>{formatRelativeTime(message.createdAt)}</span>
        {message.editedAt && <span>· edited</span>}
        {meta}
      </div>
    </div>
  );
}
