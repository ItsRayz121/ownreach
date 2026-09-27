"use client";

import { ComposerBase } from "@/components/composer/composer-base";
import { sendMessage } from "@/lib/actions/messages";
import type { ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import type { MessageItem } from "@/lib/data/messages";

interface MessageComposerProps {
  conversationId: string;
  onSent: (message: MessageItem, tempId?: string) => void;
  onOptimisticSend?: (tempId: string, body: string, replyTarget: ComposerReplyTarget | null) => void;
  onSendError?: (tempId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
}

export function MessageComposer({ conversationId, ...props }: MessageComposerProps) {
  return (
    <ComposerBase<MessageItem>
      {...props}
      onSend={(body, replyTarget) =>
        sendMessage({
          conversationId,
          body,
          replyToMessageId: replyTarget?.messageId,
          replyExcerpt: replyTarget?.excerpt,
        })
      }
    />
  );
}
