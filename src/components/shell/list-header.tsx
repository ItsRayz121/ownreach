import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Shared look of the round "+" / action button in the Chats, Groups and Channels headers. */
export const headerActionClassName =
  "bg-accent text-accent-foreground hover:bg-accent/70 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors";

interface ListHeaderProps {
  title: string;
  /** Primary action (the "+" button), top right. */
  action?: React.ReactNode;
  /** Search field, filter chips… stacked under the title. */
  children?: React.ReactNode;
}

// Sticky header shared by the Chats, Groups and Channels lists so the three
// sections look and behave the same. It covers the status-bar inset itself
// because these pages hide the app's top bar on phones.
export function ListHeader({ title, action, children }: ListHeaderProps) {
  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex flex-col gap-2.5 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2.5 backdrop-blur md:pt-3">
      <div className="flex h-10 items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}

// Always-visible search box. Presentational: pass `name`/`defaultValue` to use
// it inside a GET form, or `value`/`onChange` for client-side filtering.
export function SearchField({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        className={cn("bg-muted/60 h-10 rounded-full border-transparent pr-4 pl-10 [&::-webkit-search-cancel-button]:hidden", className)}
        {...props}
      />
    </div>
  );
}


/** Horizontally scrolling row of pill filters (All / Unread / Requests). */
export function FilterChipRow({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>;
}

export const filterChipClassName = (active: boolean) =>
  cn(
    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
  );

export function ChipCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
        active ? "bg-primary-foreground/25" : "bg-primary text-primary-foreground"
      )}
    >
      {count}
    </span>
  );
}

