import { cn } from "@/lib/utils";

interface ReplyPreviewProps {
  senderName: string;
  text: string;
  mine?: boolean;
  onClick?: () => void;
}

// Quoted-snippet strip shown above a message bubble when it replies to
// another message (or a highlighted excerpt of one).
export function ReplyPreview({ senderName, text, mine, onClick }: ReplyPreviewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-1 block max-w-full truncate rounded-md border-l-2 px-2 py-1 text-left text-xs",
        mine ? "border-primary-foreground/50 bg-primary-foreground/10" : "border-primary/50 bg-foreground/5"
      )}
    >
      <span className="font-medium">{senderName}</span>
      <span className="opacity-80"> · {text}</span>
    </button>
  );
}
