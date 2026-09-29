"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListHeader, SearchField, FilterChipRow, filterChipClassName } from "@/components/shell/list-header";
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
      <ListHeader title={label} action={<CreateCommunityDialog defaultKind={kind} iconOnly />}>
        <SearchField value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${lowerLabel}`} aria-label={`Search ${lowerLabel}`} />
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
                : `Tap the + above to create your first ${kind}.`
          }
          action={
            <Link
              href={`/communities/discover?kind=${kind}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="text-primary flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Compass className="size-4" />
              Discover public {lowerLabel}
            </Link>
          }
        />
      ) : (
        filtered.map((community) => <CommunityListItem key={community.id} community={community} />)
      )}
    </div>
  );
}
