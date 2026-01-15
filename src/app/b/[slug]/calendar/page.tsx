"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import PublicBookingShell from "../_components/PublicBookingShell";
import { usePublicBusiness } from "../_components/usePublicBusiness";

function weekdayFromDateString(dateStr: string): number {
  // Weekday for a civil date is timezone-independent.
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.getUTCDay();
}

function normalizeWindows(day: any): Array<{ start: string; end: string }> {
  const windows = Array.isArray(day?.windows) ? day.windows : [];
  const normalized = windows
    .map((w: any) => ({
      start: String(w?.start ?? "").trim(),
      end: String(w?.end ?? "").trim(),
    }))
    .filter(
      (w: any) =>
        /^\d{2}:\d{2}$/.test(w.start) &&
        /^\d{2}:\d{2}$/.test(w.end) &&
        w.start < w.end
    );

  if (normalized.length > 0) return normalized;

  const start = String(day?.start ?? "").trim();
  const end = String(day?.end ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end) {
    return [{ start, end }];
  }

  return [];
}

export default function PublicCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();
  const isPublicId = /^\d{5}$/.test(raw);

  const serviceId = String(searchParams.get("serviceId") ?? "").trim();

  const [month, setMonth] = React.useState<Date>(() => new Date());

  const { data: business, loading, resolvedPublicId } = usePublicBusiness(raw);

  const publicId = React.useMemo(() => {
    if (isPublicId) return raw;
    return resolvedPublicId;
  }, [isPublicId, raw, resolvedPublicId]);

  const tz = String(business?.availability?.timezone ?? "").trim() || "UTC";

  const weekStartsOn = React.useMemo<0 | 1>(() => {
    const v = Number((business as any)?.availability?.weekStartsOn);
    return v === 1 ? 1 : 0;
  }, [business]);

  const availabilityByDay = React.useMemo(() => {
    const days = Array.isArray((business as any)?.availability?.days)
      ? (business as any).availability.days
      : [];
    const map = new Map<
      number,
      { enabled: boolean; windows: Array<{ start: string; end: string }> }
    >();
    for (const d of days) {
      const day = Number(d?.day);
      if (!Number.isFinite(day) || day < 0 || day > 6) continue;
      const enabled = (d as any)?.enabled !== false;
      const windows = normalizeWindows(d);
      map.set(day, { enabled, windows });
    }
    return map;
  }, [business]);

  const isDateEnabled = React.useCallback(
    (date: Date) => {
      if (!business) return false;
      if (!serviceId) return false;

      const dateStr = formatDateInTimeZone(date, tz);
      if (!dateStr) return false;
      const weekday = weekdayFromDateString(dateStr);

      const dayConfig = availabilityByDay.get(weekday);
      if (!dayConfig) return false;
      if (!dayConfig.enabled) return false;
      if (!dayConfig.windows || dayConfig.windows.length === 0) return false;
      return true;
    },
    [availabilityByDay, business, serviceId, tz]
  );

  React.useEffect(() => {
    if (!raw) return;
    if (isPublicId) return;
    if (!resolvedPublicId) return;

    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(resolvedPublicId)}/calendar${
        qsString ? `?${qsString}` : ""
      }`
    );
  }, [isPublicId, raw, resolvedPublicId, router, serviceId]);

  React.useEffect(() => {
    if (!serviceId) {
      if (!publicId) return;
      router.replace(`/b/${encodeURIComponent(publicId)}`);
    }
  }, [publicId, router, serviceId]);

  return (
    <PublicBookingShell
      business={business}
      title="Pick a date"
      subtitle={business?.business?.name ? "Choose a date" : ""}
      onBack={
        publicId
          ? () => router.replace(`/b/${encodeURIComponent(publicId)}`)
          : undefined
      }
      showGallery={false}
    >
      {loading ? (
        <CenteredSpinner fullPage />
      ) : !business ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Business not found
        </div>
      ) : (
        <div className="space-y-4">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            weekStartsOn={weekStartsOn}
            className="p-0 w-full"
            classNames={{
              months: "flex flex-col space-y-0",
              month: "space-y-3",
              caption: "flex items-center justify-between px-1",
              caption_label:
                "text-sm font-semibold text-gray-900 dark:text-white",
              nav: "flex items-center gap-1",
              nav_button:
                "h-8 w-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent p-0 opacity-90 hover:opacity-100",
              nav_button_previous: "relative left-0",
              nav_button_next: "relative right-0",
              table: "w-full border-collapse",
              head_row: "grid grid-cols-7",
              head_cell:
                "w-full text-center text-[0.75rem] font-medium text-gray-500 dark:text-gray-400",
              row: "grid grid-cols-7 mt-2",
              cell: "p-0 w-full grid place-items-center",
              day: "h-10 w-10 rounded-xl text-sm font-medium transition cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
              day_today:
                "border border-primary/40 text-gray-900 dark:text-white hover:bg-transparent",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              day_disabled:
                "text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed hover:bg-transparent",
              day_outside: "text-gray-300 dark:text-gray-700 opacity-40",
            }}
            disabled={(date) => {
              return !isDateEnabled(date);
            }}
            onSelect={(date) => {
              if (!date) return;
              if (!isDateEnabled(date)) return;

              const dateStr = formatDateInTimeZone(date, tz);
              if (!dateStr) return;

              if (!publicId) return;

              router.push(
                `/b/${encodeURIComponent(
                  publicId
                )}/times?serviceId=${encodeURIComponent(
                  serviceId
                )}&date=${encodeURIComponent(dateStr)}`
              );
            }}
          />
        </div>
      )}
    </PublicBookingShell>
  );
}
