"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContactSearch } from "@/lib/hooks/use-contact-search";

interface ContactPickerDialogProps<TMessage> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (userId: string) => Promise<TMessage>;
  onShared: (message: TMessage) => void;
}

// Opened from the composer's + menu, which owns the `open` state.
export function ContactPickerDialog<TMessage>({ open, onOpenChange, onShare, onShared }: ContactPickerDialogProps<TMessage>) {
  const { query, setQuery, results, isSearching, trimmedQuery, reset } = useContactSearch(open);
  const [isSharing, startTransition] = useTransition();

  function handlePick(userId: string) {
    startTransition(async () => {
      try {
        const message = await onShare(userId);
        onShared(message);
        onOpenChange(false);
        reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't share that contact.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share a contact</DialogTitle>
          <DialogDescription>Search for someone to share their profile in this chat.</DialogDescription>
        </DialogHeader>

        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or username…" autoFocus />

        <div className="max-h-64 overflow-y-auto">
          {isSearching ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{trimmedQuery ? "No one found." : "Start typing to search."}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {results.map((r) => (
                <button
                  key={r.userId}
                  type="button"
                  disabled={isSharing}
                  onClick={() => handlePick(r.userId)}
                  className="hover:bg-accent/60 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-50"
                >
                  <UserAvatar src={r.avatarUrl} name={r.displayName} className="size-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.displayName}</span>
                    <span className="text-muted-foreground block truncate text-xs">@{r.username}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
