"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet";
import { SearchField, headerActionClassName } from "@/components/shell/list-header";
import { useContactSearch } from "@/lib/hooks/use-contact-search";
import { StartConversationRow } from "./start-conversation-row";

// The "+" in the Chats header: find someone by name or @username and open (or
// start) a conversation with them.
export function NewChatButton() {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, isSearching, trimmedQuery } = useContactSearch(open);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={headerActionClassName} aria-label="New chat" aria-haspopup="dialog">
        <Plus className="size-5" />
      </button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent title="New chat" className="md:w-96">
          <div className="flex min-h-0 flex-col gap-2 px-4 pt-3 pb-2">
            <h2 className="text-base font-semibold">New chat</h2>
            <SearchField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or @username" autoFocus />
          </div>
          <div className="min-h-32 flex-1 overflow-y-auto pb-1">
            {isSearching ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                {trimmedQuery ? "No one found." : "Type a name or @username to find someone."}
              </p>
            ) : (
              results.map((r) => (
                <StartConversationRow key={r.userId} userId={r.userId} username={r.username} displayName={r.displayName} avatarUrl={r.avatarUrl} />
              ))
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
