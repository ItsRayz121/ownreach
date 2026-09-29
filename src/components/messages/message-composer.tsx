"use client";

import { ComposerBase, type ComposerEditTarget, type PendingAttachment } from "@/components/composer/composer-base";
import { useComposerExtras } from "@/components/composer/composer-extras";
import { sendMessage, createPoll, shareContact, editMessage } from "@/lib/actions/messages";
import type { ComposerReplyTarget } from "./composer-reply-banner";
import type { MessageItem } from "@/lib/data/messages";

interface MessageComposerProps {
  conversationId: string;
  onSent: (message: MessageItem, tempId?: string) => void;
  onOptimisticSend?: (tempId: string, body: string, replyTarget: ComposerReplyTarget | null, attachment: PendingAttachment | null) => void;
  onSendError?: (tempId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
  editTarget?: ComposerEditTarget | null;
  onCancelEdit?: () => void;
  onEdited?: (messageId: string, body: string, editedAt: Date) => void;
}

export function MessageComposer({ conversationId, editTarget, onCancelEdit, onEdited, ...props }: MessageComposerProps) {
  const extras = useComposerExtras<MessageItem>({
    createPoll: (question, options, allowMultiple) => createPoll({ conversationId, question, options, allowMultiple }),
    shareContact: (userId) => shareContact(conversationId, userId),
    onSent: props.onSent,
  });

  return (
    <ComposerBase<MessageItem>
      {...props}
      {...extras}
      editTarget={editTarget}
      onCancelEdit={onCancelEdit}
      onEditSubmit={async (messageId, body) => {
        const result = await editMessage({ messageId, body });
        onEdited?.(messageId, result.body, result.editedAt);
      }}
      onSend={(body, replyTarget, attachment) =>
        sendMessage({
          conversationId,
          body,
          replyToMessageId: replyTarget?.messageId,
          replyExcerpt: replyTarget?.excerpt,
          mediaUrl: attachment?.url,
          mediaPublicId: attachment?.publicId,
          mediaWidth: attachment?.width,
          mediaHeight: attachment?.height,
        })
      }
    />
  );
}
