"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListHeader, FilterChipRow, headerIconButtonClassName } from "@/components/shell/list-header";
import { filterChipClassName } from "@/components/shell/filter-chip";
import { CommunityListItem } from "./community-list-item";
import { CreateCommunityDialog } from "./create-community-dialog";
import type { CommunitySummary } from "@/lib/data/communities";

interface CommunitiesViewProps {
  communities: CommunitySummary[];
  kind: "group" | "channel";
  label: string;
}

export function CommunitiesView({ communities, kind, label }: CommunitiesViewProps) {
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter((c) => (!unreadOnly || c.unread) && (!q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)));
  }, [communities, query, unreadOnly]);

  const lowerLabel = label.toLowerCase();

  return (
    <div>
      <ListHeader
        title={label}
        searchPlaceholder={`Search ${lowerLabel}`}
        searchInputProps={{ value: query, onChange: (e) => setQuery(e.target.value) }}
        onSearchClose={() => setQuery("")}
        startActions={<CreateCommunityDialog defaultKind={kind} iconTrigger />}
        endActions={
          <Link href={`/communities/discover?kind=${kind}`} aria-label={`Discover public ${lowerLabel}`} className={headerIconButtonClassName}>
            <Compass className="size-5" />
          </Link>
        }
      >
        <FilterChipRow>
          <button type="button" onClick={() => setUnreadOnly(false)} className={filterChipClassName(!unreadOnly)} aria-pressed={!unreadOnly}>
            All
          </button>
          <button type="button" onClick={() => setUnreadOnly(true)} className={filterChipClassName(unreadOnly)} aria-pressed={unreadOnly}>
            Unread
          </button>
        </FilterChipRow>
      </ListHeader>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? `No ${lowerLabel} found` : unreadOnly ? "You're all caught up" : `No ${lowerLabel} yet`}
          description={
            query
              ? `Nothing in your ${lowerLabel} matches "${query}".`
              : unreadOnly
                ? `${label} with unread messages will show up here.`
                : `Tap + to create your first ${kind}, or the compass to discover public ${lowerLabel}.`
          }
          action={
            query ? (
              <Link
                href={`/communities/discover?kind=${kind}&q=${encodeURIComponent(query)}`}
                className="text-primary flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <Compass className="size-4" />
                Search public {lowerLabel} for &quot;{query}&quot;
              </Link>
            ) : undefined
          }
        />
      ) : (
        filtered.map((community) => <CommunityListItem key={community.id} community={community} />)
      )}
    </div>
  );
}
