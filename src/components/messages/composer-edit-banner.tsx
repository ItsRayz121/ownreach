import { Pencil, X } from "lucide-react";

export function ComposerEditBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="bg-muted/40 animate-in fade-in slide-in-from-bottom-1 flex items-center gap-2 border-b py-1.5 pr-1 pl-3 duration-150">
      <Pencil className="text-primary size-3.5 shrink-0" />
      <p className="text-primary min-w-0 flex-1 truncate text-xs font-medium">Editing message</p>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel edit"
        className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
