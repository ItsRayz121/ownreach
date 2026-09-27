import { X } from "lucide-react";

export interface ComposerReplyTarget {
  messageId: string;
  senderName: string;
  excerpt: string;
}

export function ComposerReplyBanner({ target, onCancel }: { target: ComposerReplyTarget; onCancel: () => void }) {
  return (
    <div className="bg-accent/40 flex items-center gap-2 border-t px-3 py-1.5 text-xs">
      <div className="min-w-0 flex-1 truncate">
        Replying to <span className="font-medium">{target.senderName}</span>
        <span className="text-muted-foreground"> · {target.excerpt}</span>
      </div>
      <button type="button" onClick={onCancel} aria-label="Cancel reply" className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
