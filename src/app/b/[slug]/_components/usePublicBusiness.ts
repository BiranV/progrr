"use client";

import * as React from "react";
import type { PublicBusiness } from "@/lib/public-booking";

export function usePublicBusiness(slug: string) {
  const normalizedSlug = String(slug ?? "").trim();

  const [data, setData] = React.useState<PublicBusiness | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!normalizedSlug) {
      setData(null);
      setError("Business not found");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/public/business/${encodeURIComponent(normalizedSlug)}`
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Business not found");
          throw new Error(json?.error || `Request failed (${res.status})`);
        }
        if (cancelled) return;
        setData(json as PublicBusiness);
      } catch (e: any) {
        if (cancelled) return;
        setData(null);
        setError(e?.message || "Failed to load business");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedSlug]);

  return { data, loading, error };
}
