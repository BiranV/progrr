"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/hooks/useBusiness";
import { useGreeting } from "@/hooks/useGreeting";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RevenueLineChart } from "@/components/dashboard/RevenueLineChart";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { getTrialInfo } from "@/lib/trial";

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

type OutstandingPaymentsResponse = {
  ok: true;
  count: number;
  totalAmount: number;
  items: Array<{
    id: string;
    date: string;
    customerName: string;
    serviceName: string;
    price: number;
    currency: string;
    daysSinceCompleted: number;
  }>;
};

export default function DashboardPage() {
  const businessQuery = useBusiness();
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const greeting = useGreeting();
  const business = businessQuery.data;
  const businessLoading = businessQuery.isPending && !businessQuery.data;
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");
  const copyTimeoutRef = React.useRef<number | null>(null);
  const [origin, setOrigin] = React.useState("");
  const rangeArrow = "→";
  const [outstandingNotice, setOutstandingNotice] = React.useState<
    string | null
  >(null);
  const [outstandingUpdatingId, setOutstandingUpdatingId] = React.useState<
    string | null
  >(null);

  const formatDateForDisplay = React.useCallback((date: string) => {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(date ?? ""));
    if (!match) return date;
    return `${match[3]}-${match[2]}-${match[1]}`;
  }, []);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  React.useEffect(() => {
    if (!outstandingNotice) return;
    const id = window.setTimeout(() => setOutstandingNotice(null), 3500);
    return () => window.clearTimeout(id);
  }, [outstandingNotice]);

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
        1200,
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
        const msg = (json as any)?.error || "Failed to load dashboard summary";
        throw new Error(msg);
      }

      return json as DashboardSummary;
    },
  });

  const lastToastRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!summaryQuery.isError) return;
    const msg =
      (summaryQuery.error as any)?.message ||
      "Failed to load dashboard summary";
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

  const subscriptionStatus = user?.business?.subscriptionStatus ?? "trial";
  const trialTimeZone =
    summary?.businessStatus?.timeZone ||
    (user as any)?.onboarding?.availability?.timezone ||
    (user as any)?.onboarding?.business?.timezone ||
    "UTC";
  const { daysLeft: trialDaysLeft, isActive: isTrialActive } = getTrialInfo({
    trialStartAt: user?.business?.trialStartAt,
    trialEndAt: user?.business?.trialEndAt,
    timeZone: trialTimeZone,
  });
  const isTrial = subscriptionStatus === "trial" && isTrialActive;
  const isTrialEndingSoon = trialDaysLeft > 0 && trialDaysLeft <= 3;

  const [weekOffset, setWeekOffset] = React.useState(0);
  const [monthOffset, setMonthOffset] = React.useState(0);

  const weekSeriesQuery = useQuery({
    queryKey: ["dashboardRevenueSeries", "week", weekOffset],
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<RevenueSeriesResponse> => {
      const res = await fetch(
        `/api/dashboard/revenue-series?period=week&offset=${encodeURIComponent(
          String(weekOffset),
        )}`,
        { method: "GET", headers: { Accept: "application/json" } },
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
          String(monthOffset),
        )}`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || "Failed to load revenue series");
      }
      return json as RevenueSeriesResponse;
    },
  });

  const outstandingQuery = useQuery({
    queryKey: ["outstandingPayments"],
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<OutstandingPaymentsResponse> => {
      const res = await fetch("/api/appointments/outstanding", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || "Failed to load outstanding payments");
      }
      return json as OutstandingPaymentsResponse;
    },
  });

  const todayHref = summary?.todayStr
    ? `/calendar?date=${encodeURIComponent(summary.todayStr)}`
    : "/calendar";

  const markOutstandingPaid = React.useCallback(
    async (item: OutstandingPaymentsResponse["items"][number]) => {
      if (outstandingUpdatingId) return;
      setOutstandingUpdatingId(item.id);
      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(item.id)}/payment-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentStatus: "PAID" }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }

        setOutstandingNotice(t("dashboard.outstandingPaidSuccess"));

        queryClient.setQueryData(
          ["outstandingPayments"],
          (prev: OutstandingPaymentsResponse | undefined) => {
            if (!prev || !Array.isArray(prev.items)) return prev;
            const nextItems = prev.items.filter((x) => x.id !== item.id);
            const nextTotal = Math.max(
              0,
              Number(prev.totalAmount || 0) - Number(item.price || 0),
            );
            return {
              ...prev,
              items: nextItems,
              count: nextItems.length,
              totalAmount: nextTotal,
            };
          },
        );

        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      } catch (e: any) {
        toast.error(String(e?.message || t("errors.failedToSave")));
      } finally {
        setOutstandingUpdatingId(null);
      }
    },
    [outstandingUpdatingId, queryClient, t],
  );

  const weekLoading = weekSeriesQuery.isPending && !weekSeriesQuery.data;
  const monthLoading = monthSeriesQuery.isPending && !monthSeriesQuery.data;

  return (
    <div className="space-y-6 pb-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t("dashboard.title")}
      </h1>
      <div className="space-y-2">
        {greeting ? (
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {greeting} {String(business?.name ?? "") || t("dashboard.title")}
          </div>
        ) : null}
        {/* <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("dashboard.subtitle")}
        </p> */}

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
              <div className="inline-flex items-center gap-2">
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
              </div>
            ) : null}
          </Link>
        </div>
        {isTrial ? (
          <div className="flex justify-center">
            <Badge
              className={
                "border backdrop-blur-sm " +
                (isTrialEndingSoon
                  ? "bg-rose-50/80 text-rose-700 border-rose-200/70"
                  : "bg-gray-100/80 text-gray-700 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60")
              }
            >
              {t("subscription.trialBadge", { days: trialDaysLeft })}
            </Badge>
          </div>
        ) : null}
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
                {summaryLoading ? (
                  <Skeleton className="h-7 w-14" />
                ) : (
                  upcomingCount
                )}
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
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none !text-gray-900 hover:!text-gray-900 !bg-transparent hover:!bg-transparent disabled:opacity-40"
                  onClick={() => setWeekOffset((v) => v - 1)}
                  disabled={weekSeriesQuery.isFetching}
                  aria-label={t("dashboard.previousWeek")}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none !text-gray-900 hover:!text-gray-900 !bg-transparent hover:!bg-transparent disabled:opacity-40"
                  onClick={() => setWeekOffset((v) => v + 1)}
                  disabled={weekSeriesQuery.isFetching || weekOffset >= 0}
                  title={
                    weekOffset >= 0
                      ? t("dashboard.nextWeekDisabled")
                      : t("dashboard.nextWeek")
                  }
                  aria-label={
                    weekOffset >= 0
                      ? t("dashboard.nextWeekDisabled")
                      : t("dashboard.nextWeek")
                  }
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {weekSeriesQuery.data ? (
                <>
                  {formatDateForDisplay(weekSeriesQuery.data.from)}{" "}
                  <span
                    className="inline-block rtl:-scale-x-100"
                    aria-hidden="true"
                  >
                    {rangeArrow}
                  </span>{" "}
                  {formatDateForDisplay(weekSeriesQuery.data.to)}
                </>
              ) : (
                ""
              )}
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
                  {(weekSeriesQuery.data?.totalRevenue ?? 0).toLocaleString(
                    locale,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
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
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none !text-gray-900 hover:!text-gray-900 !bg-transparent hover:!bg-transparent disabled:opacity-40"
                  onClick={() => setMonthOffset((v) => v - 1)}
                  disabled={monthSeriesQuery.isFetching}
                  aria-label={t("dashboard.previousMonth")}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none !text-gray-900 hover:!text-gray-900 !bg-transparent hover:!bg-transparent disabled:opacity-40"
                  onClick={() => setMonthOffset((v) => v + 1)}
                  disabled={monthSeriesQuery.isFetching || monthOffset >= 0}
                  title={
                    monthOffset >= 0
                      ? t("dashboard.nextMonthDisabled")
                      : t("dashboard.nextMonth")
                  }
                  aria-label={
                    monthOffset >= 0
                      ? t("dashboard.nextMonthDisabled")
                      : t("dashboard.nextMonth")
                  }
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {monthSeriesQuery.data ? (
                <>
                  {formatDateForDisplay(monthSeriesQuery.data.from)}{" "}
                  <span
                    className="inline-block rtl:-scale-x-100"
                    aria-hidden="true"
                  >
                    {rangeArrow}
                  </span>{" "}
                  {formatDateForDisplay(monthSeriesQuery.data.to)}
                </>
              ) : (
                ""
              )}
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
                  {(monthSeriesQuery.data?.totalRevenue ?? 0).toLocaleString(
                    locale,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2.5) Outstanding payments */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {t("dashboard.outstandingTitle")}
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {outstandingQuery.isLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  {t("dashboard.outstandingOpenCount", {
                    count: outstandingQuery.data?.count ?? 0,
                  })}
                </>
              )}
            </div>
          </div>
          {outstandingNotice ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
              {outstandingNotice}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-2">
          {outstandingQuery.isError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {t("dashboard.loadingFailed")}
            </div>
          ) : null}

          {outstandingQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (outstandingQuery.data?.items?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {t("dashboard.outstandingOpenTotal")} {currencySymbol || ""}
                {(outstandingQuery.data?.totalAmount ?? 0).toLocaleString(
                  locale,
                  {
                    maximumFractionDigits: 2,
                  },
                )}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
                {outstandingQuery.data?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.customerName || t("dashboard.outstandingUnnamed")}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.serviceName || ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateForDisplay(item.date)} •{" "}
                        {t("dashboard.outstandingDaysAgo", {
                          count: item.daysSinceCompleted,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={outstandingUpdatingId === item.id}
                          onCheckedChange={(checked) => {
                            if (!checked) return;
                            markOutstandingPaid(item);
                          }}
                          disabled={
                            outstandingUpdatingId !== null &&
                            outstandingUpdatingId !== item.id
                          }
                          aria-label={t("calendar.paid")}
                          className="scale-90"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                          {t("calendar.paid")}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {currencySymbol || ""}
                        {Number(item.price || 0).toLocaleString(locale, {
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t("dashboard.outstandingEmpty")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) Public booking link */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.publicBookingLink")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {businessLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Input
              readOnly
              value={bookingLink}
              placeholder={t("common.loading")}
            />
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
