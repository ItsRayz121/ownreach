"use client";

import { useEffect, useRef, useState } from "react";
import { searchContacts } from "@/lib/actions/messages";

export interface ContactResult {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Debounced people search for the contact picker and the New chat sheet. Only searches while `active`. */
export function useContactSearch(active: boolean) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  // Set only from inside the debounce timeout below, never synchronously in
  // the effect body — this is what "searching for the current query" derives
  // from at render time, rather than a separately-tracked loading flag.
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(null);
  // Guards against an older (slower) request's response landing after a
  // newer one and overwriting its results — only the response matching the
  // most recently fired request is applied.
  const requestIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const isSearching = Boolean(trimmedQuery) && lastSearchedQuery !== trimmedQuery;

  useEffect(() => {
    if (!active) return;
    const trimmed = query.trim();
    const handle = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      if (!trimmed) {
        setResults([]);
        setLastSearchedQuery(null);
        return;
      }
      searchContacts(trimmed)
        .then((matches) => {
          if (requestIdRef.current !== requestId) return;
          setResults(matches);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setResults([]);
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          setLastSearchedQuery(trimmed);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, active]);

  function reset() {
    setQuery("");
    setResults([]);
  }

  return { query, setQuery, results, isSearching, trimmedQuery, reset };
}
