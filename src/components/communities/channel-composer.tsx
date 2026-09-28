"use client";

import { ComposerBase, type ComposerEditTarget } from "@/components/composer/composer-base";
import { sendChannelMessage, createChannelPoll, shareChannelContact, editChannelMessage } from "@/lib/actions/communities";
import { PollComposerDialog } from "@/components/messages/poll-composer-dialog";
import { ContactPickerDialog } from "@/components/messages/contact-picker-dialog";
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
  return (
    <ComposerBase<ChannelMessageItem>
      {...props}
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
      extraActions={
        <>
          <PollComposerDialog
            onCreate={(question, options, allowMultiple) => createChannelPoll({ channelId, question, options, allowMultiple })}
            onCreated={props.onSent}
          />
          <ContactPickerDialog onShare={(userId) => shareChannelContact(channelId, userId)} onShared={props.onSent} />
        </>
      }
    />
  );
}
