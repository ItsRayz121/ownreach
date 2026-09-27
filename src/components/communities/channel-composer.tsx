"use client";

import { ComposerBase } from "@/components/composer/composer-base";
import { sendChannelMessage } from "@/lib/actions/communities";
import type { ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import type { ChannelMessageItem } from "@/lib/data/communities";

interface ChannelComposerProps {
  channelId: string;
  onSent: (message: ChannelMessageItem) => void;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
}

export function ChannelComposer({ channelId, ...props }: ChannelComposerProps) {
  return (
    <ComposerBase<ChannelMessageItem>
      {...props}
      onSend={(body, replyTarget) =>
        sendChannelMessage({
          channelId,
          body,
          replyToMessageId: replyTarget?.messageId,
          replyExcerpt: replyTarget?.excerpt,
        })
      }
    />
  );
}
