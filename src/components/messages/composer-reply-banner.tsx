import { X } from "lucide-react";

export interface ComposerReplyTarget {
  messageId: string;
  senderName: string;
  excerpt: string;
}

export function ComposerReplyBanner({ target, onCancel }: { target: ComposerReplyTarget; onCancel: () => void }) {
  return (
    <div className="bg-muted/40 animate-in fade-in slide-in-from-bottom-1 flex items-center gap-2 border-b py-1.5 pr-1 pl-3 duration-150">
      <div className="border-primary min-w-0 flex-1 border-l-2 pl-2 leading-tight">
        <p className="text-primary truncate text-xs font-medium">Replying to {target.senderName}</p>
        <p className="text-muted-foreground truncate text-xs">{target.excerpt}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
