"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { CommunityListItem } from "./community-list-item";
import { CreateCommunityDialog } from "./create-community-dialog";
import type { CommunitySummary } from "@/lib/data/communities";

interface CommunitiesViewProps {
  communities: CommunitySummary[];
  kind: "group" | "channel";
  label: string;
}

export function CommunitiesView({ communities, kind, label }: CommunitiesViewProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q));
  }, [communities, query]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-2 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        {searchOpen ? (
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              className="pr-9 pl-9"
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
            />
            <button
              type="button"
              onClick={closeSearch}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
              aria-label="Close search"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <h1 className="flex-1 text-lg font-semibold">{label}</h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/60 shrink-0 rounded-full p-1.5 transition-colors"
              aria-label="Search"
            >
              <Search className="size-4.5" />
            </button>
            <CreateCommunityDialog defaultKind={kind} iconOnly />
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? `No ${label.toLowerCase()} found` : `No ${label.toLowerCase()} yet`}
          description={
            query
              ? `Nothing in your ${label.toLowerCase()} matches "${query}".`
              : `Tap the + above to create your first ${kind}.`
          }
          action={
            <Link
              href={`/communities/discover?kind=${kind}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="text-primary flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Compass className="size-4" />
              Discover public {label.toLowerCase()}
            </Link>
          }
        />
      ) : (
        filtered.map((community) => <CommunityListItem key={community.id} community={community} />)
      )}
    </div>
  );
}
