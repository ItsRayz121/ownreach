"use client";

import { cn } from "@/lib/utils";

interface ReactionEntry {
  emoji: string;
  userId: string;
}

interface MessageReactionsProps {
  reactions: ReactionEntry[];
  viewerId: string;
  onToggle: (emoji: string) => void;
  mine?: boolean;
}

// The grouped reaction pills under a bubble — shared between DM, group, and
// channel messages. Adding a reaction happens from the message menu
// (long-press / right-click), so there's no picker button here and a message
// nobody has reacted to takes no extra space. Tapping a pill toggles the
// viewer's own reaction of that emoji.
export function MessageReactions({ reactions, viewerId, onToggle, mine }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  const grouped = new Map<string, string[]>();
  for (const r of reactions) {
    const list = grouped.get(r.emoji) ?? [];
    list.push(r.userId);
    grouped.set(r.emoji, list);
  }

  return (
    <div className={cn("mt-1 flex flex-wrap items-center gap-1", mine ? "justify-end" : "justify-start")}>
      {[...grouped.entries()].map(([emoji, userIds]) => {
        const reacted = userIds.includes(viewerId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            aria-pressed={reacted}
            aria-label={`${emoji} ${userIds.length}${reacted ? ", you reacted" : ""}`}
            className={cn(
              "flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors",
              reacted ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent/60"
            )}
          >
            <span>{emoji}</span>
            <span className="text-muted-foreground">{userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
}
