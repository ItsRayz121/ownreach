"use client";

import { useState } from "react";
import { BarChart2, Contact } from "lucide-react";
import { PollComposerDialog } from "@/components/messages/poll-composer-dialog";
import { ContactPickerDialog } from "@/components/messages/contact-picker-dialog";
import type { AttachMenuItem } from "./composer-base";

interface UseComposerExtrasOptions<TMessage> {
  createPoll: (question: string, options: string[], allowMultiple: boolean) => Promise<TMessage>;
  shareContact: (userId: string) => Promise<TMessage>;
  onSent: (message: TMessage) => void;
}

/**
 * The poll + contact-share entries of the composer's + menu, shared by the DM
 * and group/channel composers — they differ only in which server actions
 * back the two dialogs.
 */
export function useComposerExtras<TMessage>({ createPoll, shareContact, onSent }: UseComposerExtrasOptions<TMessage>) {
  const [pollOpen, setPollOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const attachItems: AttachMenuItem[] = [
    { key: "contact", label: "Contact", icon: Contact, onSelect: () => setContactOpen(true) },
    { key: "poll", label: "Poll", icon: BarChart2, onSelect: () => setPollOpen(true) },
  ];

  const dialogs = (
    <>
      <PollComposerDialog open={pollOpen} onOpenChange={setPollOpen} onCreate={createPoll} onCreated={onSent} />
      <ContactPickerDialog open={contactOpen} onOpenChange={setContactOpen} onShare={shareContact} onShared={onSent} />
    </>
  );

  return { attachItems, dialogs };
}
