"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import PublicBookingShell from "../_components/PublicBookingShell";
import { usePublicBusiness } from "../_components/usePublicBusiness";

type SlotsResponse = {
  ok: boolean;
  date: string;
  timeZone: string;
  slots: Array<{ startTime: string; endTime: string }>;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function PublicCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const normalizedSlug = String(slug ?? "").trim();

  const serviceId = String(searchParams.get("serviceId") ?? "").trim();

  const [enabledDates, setEnabledDates] = React.useState<Set<string>>(
    new Set()
  );
  const [month, setMonth] = React.useState<Date>(() => new Date());

  const { data: business, loading } = usePublicBusiness(normalizedSlug);

  React.useEffect(() => {
    if (!serviceId) {
      router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
    }
  }, [router, serviceId, normalizedSlug]);

  React.useEffect(() => {
    if (!business || !serviceId) return;

    let cancelled = false;

    (async () => {
      const tz = String(business.availability?.timezone ?? "").trim() || "UTC";

      const s = new Set<string>();
      const from = startOfMonth(month);
      const to = endOfMonth(month);

      for (let d = from; d <= to; d = addDays(d, 1)) {
        const dateStr = formatDateInTimeZone(d, tz);
        if (!dateStr) continue;

        const dayRes = await fetch(
          `/api/public/business/${encodeURIComponent(
            normalizedSlug
          )}/availability?date=${encodeURIComponent(
            dateStr
          )}&serviceId=${encodeURIComponent(serviceId)}`
        );

        const dayJson = (await dayRes
          .json()
          .catch(() => null)) as SlotsResponse | null;

        if (!dayRes.ok || !dayJson?.ok) continue;
        if (Array.isArray(dayJson.slots) && dayJson.slots.length > 0) {
          s.add(dateStr);
        }
      }

      if (!cancelled) setEnabledDates(s);
    })();

    return () => {
      cancelled = true;
    };
  }, [business, month, serviceId, normalizedSlug]);

  const tz = String(business?.availability?.timezone ?? "").trim() || "UTC";

  return (
    <PublicBookingShell
      business={business}
      title="Pick a date"
      subtitle={business?.business?.name ? "Choose a date" : ""}
      onBack={() => router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)}
      showGallery={false}
    >
      {loading ? (
        <CenteredSpinner fullPage />
      ) : !business ? (
        <div className="space-y-4">
          <div className="text-sm text-red-600 dark:text-red-400">
            Business not found
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() =>
              router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)
            }
          >
            Back
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            disabled={(date) => {
              const dateStr = formatDateInTimeZone(date, tz);
              return !enabledDates.has(dateStr);
            }}
            onSelect={(date) => {
              if (!date) return;
              const dateStr = formatDateInTimeZone(date, tz);
              if (!dateStr) return;
              if (!enabledDates.has(dateStr)) return;

              router.push(
                `/b/${encodeURIComponent(
                  normalizedSlug
                )}/times?serviceId=${encodeURIComponent(
                  serviceId
                )}&date=${encodeURIComponent(dateStr)}`
              );
            }}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() =>
                router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)
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
