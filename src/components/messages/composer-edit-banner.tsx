import { Pencil, X } from "lucide-react";

export function ComposerEditBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="bg-accent/40 flex items-center gap-2 border-t px-3 py-1.5 text-xs">
      <Pencil className="text-muted-foreground size-3 shrink-0" />
      <div className="min-w-0 flex-1 truncate">Editing message</div>
      <button type="button" onClick={onCancel} aria-label="Cancel edit" className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
