"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronRight } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";
import { ONBOARDING_QUERY_KEY, useOnboardingSettings } from "@/hooks/useOnboardingSettings";

const DEFAULT_TIMEZONE = "Asia/Jerusalem";

const LANGUAGE_OPTIONS = [
  { code: "he", labelKey: "settings.languageHebrew", flagSrc: "/flags/il.svg" },
  { code: "en", labelKey: "settings.languageEnglish", flagSrc: "/flags/us.svg" },
] as const;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }

    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

function SettingsRowContent({
  title,
  description,
  destructive = false,
}: {
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    <>
      <div className="min-w-0">
        <div
          className={
            "text-sm font-medium truncate " +
            (destructive ? "text-destructive" : "text-foreground")
          }
        >
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {description}
          </div>
        ) : null}
      </div>

      <ChevronRight
        className={
          "h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" +
          (destructive ? " opacity-70" : "")
        }
      />
    </>
  );
}

function SettingsLinkRow({
  href,
  title,
  description,
  destructive = false,
}: {
  href: string;
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center justify-between gap-4 py-3 focus:outline-none cursor-pointer hover:bg-muted" +
        (destructive ? "" : "")
      }
    >
      <SettingsRowContent
        title={title}
        description={description}
        destructive={destructive}
      />
    </Link>
  );
}

function SettingsActionRow({
  onActivate,
  title,
  description,
  destructive = false,
}: {
  onActivate: () => void;
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    // A11y: use native button semantics instead of role="button".
    <button
      type="button"
      onClick={onActivate}
      className={
        "flex w-full items-start justify-between gap-4 py-3 focus:outline-none cursor-pointer hover:bg-muted text-start " +
        (destructive ? "" : "")
      }
    >
      <SettingsRowContent
        title={title}
        description={description}
        destructive={destructive}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { logout, setSessionUser } = useAuth();
  const { language, updateUserLanguage } = useLocale();
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggingOutRef = React.useRef(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [exportPending, setExportPending] = React.useState(false);
  const {
    data: onboardingRes,
    isPending: onboardingPending,
    isError: onboardingError,
    error: onboardingErrorValue,
  } = useOnboardingSettings();
  const [timeZone, setTimeZone] = React.useState(DEFAULT_TIMEZONE);
  const [savingTimeZone, setSavingTimeZone] = React.useState(false);

  const supportedTimeZones = React.useMemo(() => {
    try {
      const fn = (Intl as any)?.supportedValuesOf;
      if (typeof fn === "function") {
        const values = fn("timeZone") as unknown;
        if (Array.isArray(values)) {
          return values.map((v) => String(v)).filter(Boolean);
        }
      }
    } catch {
      // ignore
    }
    return [] as string[];
  }, []);

  const uiTimeZones = React.useMemo(
    () => (supportedTimeZones.length ? supportedTimeZones : [DEFAULT_TIMEZONE]),
    [supportedTimeZones]
  );

  const currentLanguageOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === language) || LANGUAGE_OPTIONS[1];

  React.useEffect(() => {
    if (!onboardingRes) return;
    const rawTz = String(
      (onboardingRes as any)?.onboarding?.availability?.timezone ?? ""
    ).trim();
    setTimeZone(rawTz || DEFAULT_TIMEZONE);
  }, [onboardingRes]);

  React.useEffect(() => {
    if (!onboardingError) return;
    toast.error((onboardingErrorValue as any)?.message || t("errors.failedToLoad"));
  }, [onboardingError, onboardingErrorValue, t]);

  const onTimeZoneChange = React.useCallback(
    async (value: string) => {
      const next = String(value || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
      if (next === timeZone) return;
      const prev = timeZone;

      setTimeZone(next);
      setSavingTimeZone(true);
      try {
        await apiFetch("/api/onboarding", {
          method: "PATCH",
          body: JSON.stringify({
            availability: {
              timezone: next,
            },
          }),
        });
        queryClient.setQueryData(ONBOARDING_QUERY_KEY, (prevData: any) => ({
          ...(prevData || {}),
          onboarding: {
            ...((prevData as any)?.onboarding || {}),
            availability: {
              ...((prevData as any)?.onboarding?.availability || {}),
              timezone: next,
            },
          },
        }));
        toast.success(t("common.done"));
      } catch (e: any) {
        setTimeZone(prev);
        toast.error(e?.message || t("errors.failedToSave"));
      } finally {
        setSavingTimeZone(false);
      }
    },
    [queryClient, t, timeZone]
  );

  const onLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await logout();
      await queryClient.cancelQueries();
      queryClient.clear();
    } finally {
      router.replace("/auth");
      isLoggingOutRef.current = false;
    }
  };

  const onDeleteAccount = async () => {
    if (deletePending) return;
    setDeletePending(true);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        let message = t("errors.requestFailed", { status: res.status });
        try {
          const body = await res.json();
          if (body?.error) message = t("errors.somethingWentWrong");
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      // Clear all client-side state/caches.
      setSessionUser(null);
      await queryClient.cancelQueries();
      queryClient.clear();

      router.replace("/auth/goodbye");
    } catch (e: any) {
      toast.error(t("errors.failedToDeleteAccount"));
    } finally {
      setDeletePending(false);
    }
  };

  const onDownloadData = async () => {
    if (exportPending) return;
    setExportPending(true);
    try {
      const [onboardingRes, businessRes, customersRes, meRes] = await Promise.all([
        fetch("/api/onboarding", { method: "GET" }),
        fetch("/api/business", { method: "GET" }),
        fetch("/api/customers", { method: "GET" }),
        fetch("/api/me", { method: "GET" }),
      ]);

      const onboardingPayload = onboardingRes.ok
        ? await onboardingRes.json().catch(() => null)
        : null;
      const businessPayload = businessRes.ok
        ? await businessRes.json().catch(() => null)
        : null;
      const customersPayload = customersRes.ok
        ? await customersRes.json().catch(() => null)
        : null;
      const mePayload = meRes.ok ? await meRes.json().catch(() => null) : null;

      const onboarding = onboardingPayload && typeof onboardingPayload === "object"
        ? (onboardingPayload as any).onboarding
        : null;

      const services = Array.isArray(onboarding?.services)
        ? onboarding.services.map((s: any) => ({
          id: String(s?.id ?? "").trim(),
          name: String(s?.name ?? "").trim(),
          durationMinutes: Number(s?.durationMinutes),
          price: typeof s?.price === "number" ? s.price : Number(s?.price) || 0,
          description: typeof s?.description === "string" ? s.description : undefined,
          isActive: s?.isActive !== false,
        }))
        : [];

      const availability = onboarding?.availability
        ? {
          timezone: String(onboarding?.availability?.timezone ?? "").trim(),
          weekStartsOn:
            onboarding?.availability?.weekStartsOn === 0 ||
              onboarding?.availability?.weekStartsOn === 1
              ? onboarding.availability.weekStartsOn
              : undefined,
          days: Array.isArray(onboarding?.availability?.days)
            ? onboarding.availability.days.map((d: any) => ({
              day: Number(d?.day),
              enabled: Boolean(d?.enabled),
              ranges: Array.isArray(d?.ranges)
                ? d.ranges.map((r: any) => ({
                  start: String(r?.start ?? "").trim(),
                  end: String(r?.end ?? "").trim(),
                }))
                : undefined,
            }))
            : [],
        }
        : { timezone: "", days: [] };

      const customers = Array.isArray(customersPayload?.customers)
        ? customersPayload.customers.map((c: any) => ({
          externalId: String(c?._id ?? "").trim(),
          fullName: String(c?.fullName ?? "").trim(),
          phone: String(c?.phone ?? "").trim(),
          email: String(c?.email ?? "").trim() || undefined,
          status: String(c?.status ?? "ACTIVE"),
          activeBookingsCount: Number(c?.activeBookingsCount ?? 0),
          lastAppointmentAt: c?.lastAppointmentAt,
          createdAt: c?.createdAt,
        }))
        : [];

      const payload = {
        exportMeta: {
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
        },
        business: businessPayload ?? null,
        services,
        availability,
        customers,
        system: {
          subscriptionStatus: mePayload?.business?.subscriptionStatus,
          trialStartAt: mePayload?.business?.trialStartAt,
          trialEndAt: mePayload?.business?.trialEndAt,
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "progrr-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(t("errors.failedToExport"));
    } finally {
      setExportPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Section 1: Business */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.businessSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/settings/business"
              title={t("settings.businessDetails")}
              description={t("settings.businessDetailsDesc")}
            />
            <SettingsLinkRow
              href="/settings/opening-hours"
              title={t("settings.bookingHours")}
              description={t("settings.bookingHoursDesc")}
            />
            <SettingsLinkRow
              href="/settings/services"
              title={t("settings.services")}
              description={t("settings.servicesDesc")}
            />
            <SettingsLinkRow
              href="/settings/branding"
              title={t("settings.branding")}
              description={t("settings.brandingDesc")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Subscription */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.languageRegion")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <div className="py-3 space-y-2">
              <Label>{t("settings.language")}</Label>
              <Select
                value={language}
                onValueChange={(value) =>
                  updateUserLanguage(value === "en" ? "en" : "he")
                }
              >
                <SelectTrigger>
                  <SelectValue asChild>
                    <span className="flex items-center gap-2 min-w-0">
                      <img
                        src={currentLanguageOption.flagSrc}
                        alt=""
                        className="h-3 w-5 rounded-[2px] object-cover"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {t(currentLanguageOption.labelKey)}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      <img
                        src={option.flagSrc}
                        alt=""
                        className="h-3 w-5 rounded-[2px] object-cover"
                        aria-hidden="true"
                      />
                      <span>{t(option.labelKey)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {t("settings.languageHelp")}
              </div>
            </div>
            <div className="py-3 space-y-2">
              <Label>{t("settings.timeZoneTitle")}</Label>
              <Select
                value={timeZone}
                onValueChange={onTimeZoneChange}
                disabled={savingTimeZone || onboardingPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.timeZoneSelect")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {uiTimeZones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {t("settings.timeZoneSubtitle")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Subscription */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.subscriptionSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/settings/subscription"
              title={t("settings.plansPricing")}
              description={t("settings.plansPricingDesc")}
            />
            <SettingsLinkRow
              href="/settings/billing"
              title={t("settings.billingHistory")}
              description={t("settings.billingHistoryDesc")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Support & Legal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.supportSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/support"
              title={t("settings.support")}
              description={t("settings.supportDesc")}
            />
            <SettingsLinkRow
              href="/legal/privacy"
              title={t("settings.privacy")}
              description={t("settings.privacyDesc")}
            />
            <SettingsLinkRow
              href="/legal/terms"
              title={t("settings.terms")}
              description={t("settings.termsDesc")}
            />
            <SettingsLinkRow
              href="/legal/accessibility"
              title={t("settings.accessibility")}
              description={t("settings.accessibilityDesc")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Account */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.accountSection")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsActionRow
              title={t("settings.logout")}
              description={t("settings.logoutDesc")}
              onActivate={onLogout}
            />
            <SettingsActionRow
              title={t("settings.deleteAccount")}
              description={t("settings.deleteAccountDesc")}
              destructive
              onActivate={() => setDeleteOpen(true)}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !deletePending && setDeleteOpen(open)}
      >
        <DialogContent showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.deleteDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {t("settings.deleteListTitle")}
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>{t("settings.deleteListBusiness")}</li>
              <li>{t("settings.deleteListCustomers")}</li>
              <li>{t("settings.deleteListAppointments")}</li>
              <li>{t("settings.deleteListServices")}</li>
              <li>{t("settings.deleteListSettings")}</li>
            </ul>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={onDownloadData}
              disabled={exportPending}
            >
              {exportPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("settings.deleteDownload")}
            </Button>

            <div className="space-y-2">
              <Label>{t("settings.deleteTypeConfirm")}</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t("settings.deletePlaceholder")}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              disabled={deletePending || deleteConfirmText !== "DELETE"}
              onClick={onDeleteAccount}
            >
              {deletePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("settings.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
