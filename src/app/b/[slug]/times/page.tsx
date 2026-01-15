"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import PublicBookingShell from "../_components/PublicBookingShell";
import { usePublicBusiness } from "../_components/usePublicBusiness";

type SlotsResponse = {
  ok: boolean;
  date: string;
  timeZone: string;
  service: { id: string; name: string; durationMinutes: number };
  slots: Array<{ startTime: string; endTime: string }>;
};

export default function PublicTimesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const normalizedSlug = String(slug ?? "").trim();

  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const date = String(searchParams.get("date") ?? "").trim();

  const { data: business } = usePublicBusiness(normalizedSlug);

  const [data, setData] = React.useState<SlotsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!normalizedSlug) {
      setData(null);
      setError("Business not found");
      setLoading(false);
      return;
    }

    if (!serviceId) {
      router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
      return;
    }

    if (!date) {
      router.replace(
        `/b/${encodeURIComponent(
          normalizedSlug
        )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
      );
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/public/business/${encodeURIComponent(
            normalizedSlug
          )}/availability?date=${encodeURIComponent(
            date
          )}&serviceId=${encodeURIComponent(serviceId)}`
        );

        const json = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(json?.error || `Request failed (${res.status})`);

        if (cancelled) return;
        setData(json as SlotsResponse);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load slots");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, router, serviceId, normalizedSlug]);

  return (
    <PublicBookingShell
      business={business}
      title="Pick a time"
      subtitle={date ? `For ${date}` : "Choose a time"}
      onBack={() =>
        router.replace(
          `/b/${encodeURIComponent(
            normalizedSlug
          )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
        )
      }
      showGallery={false}
    >
      {loading ? (
        <CenteredSpinner fullPage />
      ) : error || !data ? (
        <div className="space-y-4">
          <div className="text-sm text-red-600 dark:text-red-400">
            {error || "No slots"}
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() =>
              router.replace(
                `/b/${encodeURIComponent(
                  normalizedSlug
                )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
              )
            }
          >
            Back
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.slots.map((s) => (
            <button
              key={s.startTime}
              className={
                "w-full rounded-2xl border border-gray-200 dark:border-gray-800 " +
                "bg-white/70 dark:bg-gray-950/20 p-4 text-left shadow-sm " +
                "transition cursor-pointer " +
                "hover:bg-white hover:shadow-md hover:-translate-y-[1px] " +
                "dark:hover:bg-gray-900/30 " +
                "active:translate-y-0 active:shadow-sm"
              }
              onClick={() =>
                router.push(
                  `/b/${encodeURIComponent(
                    normalizedSlug
                  )}/details?serviceId=${encodeURIComponent(
                    serviceId
                  )}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(
                    s.startTime
                  )}`
                )
              }
            >
              <div className="font-semibold text-gray-900 dark:text-white">
                {s.startTime}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Ends {s.endTime}
              </div>
            </button>
          ))}

          {!data.slots.length && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              No times available.
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() =>
                router.replace(
                  `/b/${encodeURIComponent(
                    normalizedSlug
                  )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
                )
              }
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </PublicBookingShell>
  );
}
