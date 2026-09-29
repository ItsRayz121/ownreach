"use client";

import { ComposerBase, type ComposerEditTarget } from "@/components/composer/composer-base";
import { useComposerExtras } from "@/components/composer/composer-extras";
import { sendChannelMessage, createChannelPoll, shareChannelContact, editChannelMessage } from "@/lib/actions/communities";
import type { ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import type { ChannelMessageItem } from "@/lib/data/communities";

interface ChannelComposerProps {
  channelId: string;
  onSent: (message: ChannelMessageItem) => void;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
  editTarget?: ComposerEditTarget | null;
  onCancelEdit?: () => void;
  onEdited?: (messageId: string, body: string, editedAt: Date) => void;
}

export function ChannelComposer({ channelId, editTarget, onCancelEdit, onEdited, ...props }: ChannelComposerProps) {
  const extras = useComposerExtras<ChannelMessageItem>({
    createPoll: (question, options, allowMultiple) => createChannelPoll({ channelId, question, options, allowMultiple }),
    shareContact: (userId) => shareChannelContact(channelId, userId),
    onSent: props.onSent,
  });

  return (
    <ComposerBase<ChannelMessageItem>
      {...props}
      {...extras}
      editTarget={editTarget}
      onCancelEdit={onCancelEdit}
      onEditSubmit={async (messageId, body) => {
        const result = await editChannelMessage({ messageId, body });
        onEdited?.(messageId, result.body, result.editedAt);
      }}
      onSend={(body, replyTarget, attachment) =>
        sendChannelMessage({
          channelId,
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
