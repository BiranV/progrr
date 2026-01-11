import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const MIN_SEARCH_LEN = 3;

// Requirements: Cache TTL 30 minutes (in-memory React Query cache only)
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

type CatalogType = "exercise" | "food";

export function useCatalogSearch<T>(type: CatalogType) {
  // The query that is actually executed (submitted by user)
  const [activeQuery, setActiveQuery] = useState("");

  const queryKey = ["catalogSearch", type, activeQuery];

  const trimmedActiveQuery = activeQuery.trim();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // Safety guard (UI should already enforce min length)
      if (trimmedActiveQuery.length < MIN_SEARCH_LEN) return [];

      const endpoint =
        type === "exercise"
          ? `/api/exercises/catalog/search?q=${encodeURIComponent(trimmedActiveQuery)}`
          : `/api/foods/catalog/search?q=${encodeURIComponent(trimmedActiveQuery)}`;

      const res = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      return (Array.isArray(payload?.results) ? payload.results : []) as T[];
    },
    enabled: trimmedActiveQuery.length >= MIN_SEARCH_LEN,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    // Current active search term
    activeQuery,
    // Function to trigger a new search
    search: (term: string) => setActiveQuery(term),
    // Reset search results
    reset: () => setActiveQuery(""),
    // Results
    results: query.data || [],
    isLoading: query.isFetching, // use isFetching to show loading on subsequent cached searches if stale
    error: query.error ? (query.error as Error).message : null,
  };
}
