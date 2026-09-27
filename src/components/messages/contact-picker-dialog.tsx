"use client";

import { useEffect, useState, useTransition } from "react";
import { Contact as ContactIcon } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { searchContacts } from "@/lib/actions/messages";

interface ContactResult {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ContactPickerDialogProps<TMessage> {
  disabled?: boolean;
  onShare: (userId: string) => Promise<TMessage>;
  onShared: (message: TMessage) => void;
}

export function ContactPickerDialog<TMessage>({ disabled, onShare, onShared }: ContactPickerDialogProps<TMessage>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  // Set only from inside the debounce timeout below, never synchronously in
  // the effect body — this is what "searching for the current query" derives
  // from at render time, rather than a separately-tracked loading flag.
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(null);
  const [isSharing, startTransition] = useTransition();

  const trimmedQuery = query.trim();
  const isSearching = Boolean(trimmedQuery) && lastSearchedQuery !== trimmedQuery;

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const handle = setTimeout(() => {
      if (!trimmed) {
        setResults([]);
        setLastSearchedQuery(null);
        return;
      }
      searchContacts(trimmed)
        .then((matches) => setResults(matches))
        .catch(() => setResults([]))
        .finally(() => setLastSearchedQuery(trimmed));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  function handlePick(userId: string) {
    startTransition(async () => {
      try {
        const message = await onShare(userId);
        onShared(message);
        setOpen(false);
        setQuery("");
        setResults([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't share that contact.");
      }
    });
  }

  if (disabled) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<button type="button" className="text-muted-foreground hover:text-foreground shrink-0" />}
        aria-label="Share a contact"
        title="Share a contact"
      >
        <ContactIcon className="size-4.5" />
      </DialogTrigger>
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
