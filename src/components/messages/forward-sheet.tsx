"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { listForwardTargets, forwardMessageText, type ForwardTarget } from "@/lib/actions/forward";

interface ForwardSheetProps {
  /** The text to forward; the sheet is open while this is non-null. */
  body: string | null;
  onClose: () => void;
}

// "Forward" picker: choose a chat, group or channel to send a copy of the
// message to. Text messages only; polls, contacts and photos are not forwardable.
export function ForwardSheet({ body, onClose }: ForwardSheetProps) {
  const [targets, setTargets] = useState<ForwardTarget[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const open = body !== null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listForwardTargets()
      .then((result) => !cancelled && setTargets(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      setTargets(null);
      setFailed(false);
    };
  }, [open]);

  function handlePick(target: ForwardTarget) {
    if (!body) return;
    setSendingId(target.id);
    startTransition(async () => {
      try {
        await forwardMessageText(target, body);
        toast.success(`Forwarded to ${target.name}`);
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't forward that message.");
      } finally {
        setSendingId(null);
      }
    });
  }

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent title="Forward to" className="md:w-96">
        <h2 className="px-4 pt-3 pb-2 text-base font-semibold">Forward to</h2>
        <div className="min-h-32 flex-1 overflow-y-auto pb-1">
          {failed ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">Couldn&apos;t load your chats.</p>
          ) : targets === null ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">Loading…</p>
          ) : targets.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">You don&apos;t have anywhere to forward this yet.</p>
          ) : (
            targets.map((target) => (
              <button
                key={`${target.type}:${target.id}`}
                type="button"
                onClick={() => handlePick(target)}
                disabled={isPending}
                className="hover:bg-accent/30 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-60"
              >
                <UserAvatar src={target.avatarUrl} name={target.name} className="size-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{target.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">{target.detail}</span>
                </span>
                {sendingId === target.id && <span className="text-muted-foreground text-xs">Sending…</span>}
              </button>
            ))
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
