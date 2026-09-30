"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListHeaderProps {
  title: string;
  /** Placeholder for the search field that replaces the title when the search icon is tapped. */
  searchPlaceholder: string;
  /** Props for the search <input>: `name`/`defaultValue` inside a GET form, or `value`/`onChange` for client-side filtering. */
  searchInputProps?: React.ComponentProps<"input">;
  /** When set, the search field is wrapped in a GET form to this path. */
  searchFormAction?: string;
  /** Extra hidden fields for the GET form (e.g. the active filter). */
  searchFormFields?: Record<string, string>;
  /** Start with the search field open (e.g. the page was loaded with a query). */
  searchOpen?: boolean;
  /** Called when search is closed via the back arrow or ×. */
  onSearchClose?: () => void;
  /** Where to go when search is closed, for server-rendered lists that filter via the URL. */
  searchCloseHref?: string;
  /** Small brand mark shown before the title. */
  logo?: React.ReactNode;
  /** Icon buttons shown before the search icon (e.g. create). Use {@link headerIconButtonClassName}. */
  startActions?: React.ReactNode;
  /** Icon buttons shown after the search icon (e.g. discover). */
  endActions?: React.ReactNode;
  /** Filter chips… stacked under the title. */
  children?: React.ReactNode;
}

const iconButtonClassName = "hover:bg-accent/60 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors";

/** Same look as the built-in search icon, for buttons/links passed as start/end actions so all header icons match. */
export const headerIconButtonClassName = iconButtonClassName;

// Sticky header shared by the Chats, Groups and Channels lists so the three
// sections look and behave the same. It shows the title and one search icon;
// tapping the icon turns the row into a search field, and the back arrow or ×
// restores the title. It covers the status-bar inset itself because these
// pages hide the app's top bar on phones.
export function ListHeader({
  title,
  searchPlaceholder,
  searchInputProps,
  searchFormAction,
  searchFormFields,
  searchOpen = false,
  onSearchClose,
  searchCloseHref,
  logo,
  startActions,
  endActions,
  children,
}: ListHeaderProps) {
  const router = useRouter();
  const [searching, setSearching] = useState(searchOpen);

  function closeSearch() {
    setSearching(false);
    onSearchClose?.();
    if (searchCloseHref) router.replace(searchCloseHref);
  }

  const field = (
    <div className="flex h-10 items-center gap-1">
      <button type="button" onClick={closeSearch} aria-label="Close search" className={cn(iconButtonClassName, "-ml-2")}>
        <ArrowLeft className="size-5" />
      </button>
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
        {...searchInputProps}
      />
      <button type="button" onClick={closeSearch} aria-label="Clear and close search" className={cn(iconButtonClassName, "-mr-2")}>
        <X className="size-5" />
      </button>
    </div>
  );

  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex flex-col gap-2.5 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2.5 backdrop-blur md:pt-3">
      {searching ? (
        searchFormAction ? (
          <form action={searchFormAction} role="search">
            {Object.entries(searchFormFields ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {field}
          </form>
        ) : (
          <div role="search">{field}</div>
        )
      ) : (
        <div className="flex h-10 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {logo}
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="-mr-2 flex shrink-0 items-center">
            {startActions}
            <button type="button" onClick={() => setSearching(true)} aria-label={`Search ${title.toLowerCase()}`} className={iconButtonClassName}>
              <Search className="size-5" />
            </button>
            {endActions}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/** Horizontally scrolling row of pill filters (All / Unread / Requests). */
export function FilterChipRow({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>;
}

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
