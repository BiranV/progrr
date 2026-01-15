"use client";

import * as React from "react";
import type { PublicBusiness } from "@/lib/public-booking";

export function usePublicBusiness(publicIdOrSlug: string): {
  data: PublicBusiness | null;
  loading: boolean;
  error: string | null;
  resolvedPublicId: string | null;
} {
  const raw = String(publicIdOrSlug ?? "").trim();
  const isPublicId = /^\d{5}$/.test(raw);

  const [data, setData] = React.useState<PublicBusiness | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedPublicId, setResolvedPublicId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (!raw) {
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
        // If a legacy slug is used in the URL, resolve it to the stable publicId
        // so the page can redirect.
        if (!isPublicId) {
          const resolveRes = await fetch(
            `/api/public/resolve-business/${encodeURIComponent(raw)}`
          );
          const resolveJson = await resolveRes.json().catch(() => null);
          if (!resolveRes.ok) {
            if (resolveRes.status === 404)
              throw new Error("Business not found");
            throw new Error(
              resolveJson?.error || `Request failed (${resolveRes.status})`
            );
          }

          const pid = String(resolveJson?.publicId ?? "").trim();
          if (!/^\d{5}$/.test(pid)) throw new Error("Business not found");
          if (cancelled) return;
          setResolvedPublicId(pid);
          setData(null);
          return;
        }

        const res = await fetch(
          `/api/public/business/${encodeURIComponent(raw)}`
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Business not found");
          throw new Error(json?.error || `Request failed (${res.status})`);
        }
        if (cancelled) return;
        setResolvedPublicId(null);
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
  }, [isPublicId, raw]);

  return { data, loading, error, resolvedPublicId };
}
