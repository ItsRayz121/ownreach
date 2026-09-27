"use client";

import { ComposerBase, type ComposerEditTarget } from "@/components/composer/composer-base";
import { sendMessage, createPoll, shareContact, editMessage } from "@/lib/actions/messages";
import { PollComposerDialog } from "./poll-composer-dialog";
import { ContactPickerDialog } from "./contact-picker-dialog";
import type { ComposerReplyTarget } from "./composer-reply-banner";
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
  editTarget?: ComposerEditTarget | null;
  onCancelEdit?: () => void;
  onEdited?: (messageId: string, body: string, editedAt: Date) => void;
}

export function MessageComposer({ conversationId, editTarget, onCancelEdit, onEdited, ...props }: MessageComposerProps) {
  return (
    <ComposerBase<MessageItem>
      {...props}
      editTarget={editTarget}
      onCancelEdit={onCancelEdit}
      onEditSubmit={async (messageId, body) => {
        const result = await editMessage({ messageId, body });
        onEdited?.(messageId, result.body, result.editedAt);
      }}
      onSend={(body, replyTarget) =>
        sendMessage({
          conversationId,
          body,
          replyToMessageId: replyTarget?.messageId,
          replyExcerpt: replyTarget?.excerpt,
        })
      }
      extraActions={
        <>
          <PollComposerDialog
            onCreate={(question, options, allowMultiple) => createPoll({ conversationId, question, options, allowMultiple })}
            onCreated={props.onSent}
          />
          <ContactPickerDialog onShare={(userId) => shareContact(conversationId, userId)} onShared={props.onSent} />
        </>
      }
    />
  );
}
