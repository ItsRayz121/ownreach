import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PollSummary } from "@/lib/data/polls";

interface PollMessageCardProps {
  poll: PollSummary;
  mine?: boolean;
  onVote: (optionId: string) => void;
}

export function PollMessageCard({ poll, mine, onVote }: PollMessageCardProps) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);

  return (
    <div className="min-w-56">
      <p className="mb-2 text-sm font-semibold">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(option.id)}
              className={cn(
                "relative block w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                mine ? "border-primary-foreground/20" : "border-border",
                option.votedByMe ? (mine ? "bg-primary-foreground/15" : "bg-primary/10") : mine ? "hover:bg-primary-foreground/10" : "hover:bg-accent/60"
              )}
            >
              <span
                className={cn("absolute inset-y-0 left-0 -z-0", mine ? "bg-primary-foreground/10" : "bg-primary/10")}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {option.votedByMe && <Check className="size-3.5 shrink-0" />}
                  <span className="truncate">{option.text}</span>
                </span>
                <span className={cn("shrink-0 text-xs", mine ? "opacity-80" : "text-muted-foreground")}>{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className={cn("mt-1.5 text-xs", mine ? "opacity-80" : "text-muted-foreground")}>
        {totalVotes} vote{totalVotes === 1 ? "" : "s"} {poll.allowMultiple ? "· Multiple answers" : ""}
      </p>
    </div>
  );
}
