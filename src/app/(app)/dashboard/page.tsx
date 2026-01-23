"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RevenueLineChart } from "@/components/dashboard/RevenueLineChart";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";

type DashboardSummary = {
  ok: true;
  todayStr: string;
  todayAppointmentsCount: number;
  upcomingAppointmentsCount: number;
  totalCustomersCount: number;
  revenueToday: number;
  completedAppointmentsCount: number;
  currency: {
    code: string;
    symbol?: string;
    name?: string;
  };
  businessStatus: {
    isOpenNow: boolean;
    label: string;
    timeZone: string;
  };
};

type RevenueSeriesResponse = {
  ok: true;
  period: "week" | "month";
  offset: number;
  from: string;
  to: string;
  timeZone: string;
  totalRevenue: number;
  points: Array<{ date: string; revenue: number; completedCount: number }>;
};

export default function DashboardPage() {
  const businessQuery = useBusiness();
  const { locale, dir } = useLocale();
  const { t } = useI18n();
  const business = businessQuery.data;
  const businessLoading = businessQuery.isPending && !businessQuery.data;
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");
  const copyTimeoutRef = React.useRef<number | null>(null);
  const [origin, setOrigin] = React.useState("");
  const PrevChevron = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextChevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bookingLink = React.useMemo(() => {
    const publicId = String((business as any)?.publicId ?? "").trim();
    if (!/^\d{5}$/.test(publicId)) return "";
    if (!origin) return "";
    return `${origin}/b/${publicId}`;
  }, [business, origin]);

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

  const summaryQuery = useQuery({
    queryKey: ["dashboardSummary"],
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<DashboardSummary> => {
      const res = await fetch("/api/dashboard/summary", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const json = (await res.json().catch(() => null)) as
        | DashboardSummary
        | { error?: string }
        | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const msg =
          (json as any)?.error || "Failed to load dashboard summary";
        throw new Error(msg);
      }

      return json as DashboardSummary;
    },
  });

  const lastToastRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!summaryQuery.isError) return;
    const msg =
      (summaryQuery.error as any)?.message || "Failed to load dashboard summary";
    if (msg && msg !== lastToastRef.current) {
      lastToastRef.current = msg;
      toast.error(msg);
    }
  }, [summaryQuery.isError, summaryQuery.error]);

  const summary = summaryQuery.data ?? null;
  const summaryLoading = summaryQuery.isPending && !summaryQuery.data;

  const upcomingCount = summary?.upcomingAppointmentsCount ?? 0;
  const isOpenNow = summary?.businessStatus?.isOpenNow;
  const revenueToday = summary?.revenueToday ?? 0;
  const currencySymbol = String(summary?.currency?.symbol ?? "").trim();

  const [weekOffset, setWeekOffset] = React.useState(0);
  const [monthOffset, setMonthOffset] = React.useState(0);

  const weekSeriesQuery = useQuery({
    queryKey: ["dashboardRevenueSeries", "week", weekOffset],
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<RevenueSeriesResponse> => {
      const res = await fetch(
        `/api/dashboard/revenue-series?period=week&offset=${encodeURIComponent(
          String(weekOffset)
        )}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || "Failed to load revenue series");
      }
      return json as RevenueSeriesResponse;
    },
  });

  const monthSeriesQuery = useQuery({
    queryKey: ["dashboardRevenueSeries", "month", monthOffset],
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<RevenueSeriesResponse> => {
      const res = await fetch(
        `/api/dashboard/revenue-series?period=month&offset=${encodeURIComponent(
          String(monthOffset)
        )}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || "Failed to load revenue series");
      }
      return json as RevenueSeriesResponse;
    },
  });

  const todayHref = summary?.todayStr
    ? `/calendar?date=${encodeURIComponent(summary.todayStr)}`
    : "/calendar";

  const weekLoading = weekSeriesQuery.isPending && !weekSeriesQuery.data;
  const monthLoading = monthSeriesQuery.isPending && !monthSeriesQuery.data;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("dashboard.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("dashboard.subtitle")}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {t("dashboard.businessStatus")}
          </div>
          <Link
            href="/settings/opening-hours"
            className="inline-flex items-center gap-2"
          >
            {summaryLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : typeof isOpenNow === "boolean" ? (
              <Badge
                variant="outline"
                className={
                  isOpenNow
                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/15 dark:text-emerald-200"
                    : "border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/50 dark:bg-red-500/15 dark:text-red-200"
                }
              >
                {isOpenNow ? t("dashboard.open") : t("dashboard.closed")}
              </Badge>
            ) : null}
          </Link>
        </div>
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
                {t("dashboard.remainingToday")}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {summaryLoading ? <Skeleton className="h-7 w-14" /> : upcomingCount}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              {t("dashboard.revenueToday")}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {summaryLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `${currencySymbol || ""}${revenueToday.toLocaleString(locale, {
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2) Revenue graphs */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {t("dashboard.revenueLast7Days")}
              </CardTitle>
              <div className="flex items-center gap-1">
                {/* A11y: icon-only buttons need accessible names */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setWeekOffset((v) => v - 1)}
                  disabled={weekSeriesQuery.isFetching}
                  aria-label={t("dashboard.previousWeek")}
                >
                  <PrevChevron className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setWeekOffset((v) => v + 1)}
                  disabled={weekSeriesQuery.isFetching || weekOffset >= 0}
                  title={weekOffset >= 0 ? t("dashboard.nextWeekDisabled") : t("dashboard.nextWeek")}
                  aria-label={weekOffset >= 0 ? t("dashboard.nextWeekDisabled") : t("dashboard.nextWeek")}
                >
                  <NextChevron className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {weekSeriesQuery.data
                ? `${weekSeriesQuery.data.from} → ${weekSeriesQuery.data.to}`
                : ""}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {weekSeriesQuery.isError ? (
              <div className="text-sm text-red-600 dark:text-red-400">
                {t("dashboard.loadingFailed")}
              </div>
            ) : null}

            {weekLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <RevenueLineChart
                points={weekSeriesQuery.data?.points ?? []}
                currencySymbol={currencySymbol}
              />
            )}

            <div className="mt-2 text-xs text-muted-foreground">
              {weekLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  {t("dashboard.total")}: {currencySymbol || ""}
                  {(weekSeriesQuery.data?.totalRevenue ?? 0).toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {t("dashboard.revenueMonthly")}
              </CardTitle>
              <div className="flex items-center gap-1">
                {/* A11y: icon-only buttons need accessible names */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setMonthOffset((v) => v - 1)}
                  disabled={monthSeriesQuery.isFetching}
                  aria-label={t("dashboard.previousMonth")}
                >
                  <PrevChevron className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setMonthOffset((v) => v + 1)}
                  disabled={monthSeriesQuery.isFetching || monthOffset >= 0}
                  title={monthOffset >= 0 ? t("dashboard.nextMonthDisabled") : t("dashboard.nextMonth")}
                  aria-label={monthOffset >= 0 ? t("dashboard.nextMonthDisabled") : t("dashboard.nextMonth")}
                >
                  <NextChevron className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {monthSeriesQuery.data
                ? `${monthSeriesQuery.data.from} → ${monthSeriesQuery.data.to}`
                : ""}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {monthSeriesQuery.isError ? (
              <div className="text-sm text-red-600 dark:text-red-400">
                {t("dashboard.loadingFailed")}
              </div>
            ) : null}

            {monthLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <RevenueLineChart
                points={monthSeriesQuery.data?.points ?? []}
                currencySymbol={currencySymbol}
                xAxisMode="day"
              />
            )}

            <div className="mt-2 text-xs text-muted-foreground">
              {monthLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  {t("dashboard.total")}: {currencySymbol || ""}
                  {(monthSeriesQuery.data?.totalRevenue ?? 0).toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3) Public booking link */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.publicBookingLink")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {businessLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Input readOnly value={bookingLink} placeholder={t("common.loading")} />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCopy}
              disabled={!bookingLink}
            >
              {copyStatus === "copied" ? t("auth.copied") : t("auth.copyLink")}
            </Button>
            <Button type="button" onClick={onShare} disabled={!bookingLink}>
              {t("auth.share")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
