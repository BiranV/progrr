"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusiness } from "@/hooks/useBusiness";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";

type DashboardSummary = {
  ok: true;
  todayStr: string;
  todayAppointmentsCount: number;
  upcomingAppointmentsCount: number;
  totalCustomersCount: number;
  businessStatus: {
    isOpenNow: boolean;
    label: string;
    timeZone: string;
  };
};

export default function DashboardPage() {
  const { data: business } = useBusiness();
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");
  const copyTimeoutRef = React.useRef<number | null>(null);

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  const bookingLink = React.useMemo(() => {
    const publicId = String((business as any)?.publicId ?? "").trim();
    if (!/^\d{5}$/.test(publicId)) return "";
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return `${origin}/b/${publicId}`;
  }, [business]);

  const onShare = React.useCallback(async () => {
    if (!bookingLink) return;

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Booking link",
          url: bookingLink,
        });
        return;
      }

      await navigator.clipboard.writeText(bookingLink);
      toast.success("Copied link");
    } catch {
      toast.error("Failed to share");
    }
  }, [bookingLink]);

  const onCopy = React.useCallback(async () => {
    if (!bookingLink) return;

    try {
      await navigator.clipboard.writeText(bookingLink);
      toast.success("Copied");
      setCopyStatus("copied");

      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(
        () => setCopyStatus("idle"),
        1200
      );
    } catch {
      toast.error("Failed to copy");
    }
  }, [bookingLink]);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setSummaryLoading(true);
        const res = await fetch("/api/dashboard/summary", {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const json = (await res.json().catch(() => null)) as
          | DashboardSummary
          | { error?: string }
          | null;

        if (cancelled) return;

        if (!res.ok || !json || (json as any).ok !== true) {
          const msg =
            (json as any)?.error || "Failed to load dashboard summary";
          toast.error(msg);
          setSummary(null);
          return;
        }

        setSummary(json as DashboardSummary);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load dashboard summary");
          setSummary(null);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayCount = summary?.todayAppointmentsCount ?? 0;
  const upcomingCount = summary?.upcomingAppointmentsCount ?? 0;
  const customersCount = summary?.totalCustomersCount ?? 0;
  const statusLabel = summary?.businessStatus?.label ?? "—";

  const todayHref = summary?.todayStr
    ? `/calendar?date=${encodeURIComponent(summary.todayStr)}`
    : "/calendar";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Overview of your business activity.
        </p>
      </div>

      {/* 1) Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={todayHref}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Card className="cursor-pointer transition-colors hover:bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Today&apos;s appointments
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {summaryLoading ? "—" : todayCount}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              Upcoming appointments
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {summaryLoading ? "—" : upcomingCount}
            </div>
          </CardContent>
        </Card>

        <Link
          href="/customers"
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Card className="cursor-pointer transition-colors hover:bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total customers</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {summaryLoading ? "—" : customersCount}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/settings/opening-hours"
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Card className="cursor-pointer transition-colors hover:bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Business status</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {summaryLoading ? "—" : statusLabel}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 2) Public booking link */}
      <Card>
        <CardHeader>
          <CardTitle>Public booking link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input readOnly value={bookingLink} placeholder="Loading…" />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCopy}
              disabled={!bookingLink}
            >
              {copyStatus === "copied" ? "Copied!" : "Copy link"}
            </Button>
            <Button type="button" onClick={onShare} disabled={!bookingLink}>
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3) Empty state note */}
      <div className="rounded-xl border bg-card text-card-foreground p-4">
        <div className="text-sm text-muted-foreground">
          Your calendar and customers will appear here once you start receiving
          bookings.
        </div>
      </div>
    </div>
  );
}
