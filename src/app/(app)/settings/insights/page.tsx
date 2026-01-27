"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useBusiness } from "@/hooks/useBusiness";
import { useI18n } from "@/i18n/useI18n";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function InsightsSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const {
    data: business,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useBusiness();

  const [enabled, setEnabled] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [consentChecked, setConsentChecked] = React.useState(false);

  React.useEffect(() => {
    if (!business) return;
    setEnabled(Boolean(business.revenueInsightsEnabled));
  }, [business]);

  React.useEffect(() => {
    if (!confirmOpen) setConsentChecked(false);
  }, [confirmOpen]);

  const persist = React.useCallback(
    async (nextEnabled: boolean) => {
      setSaving(true);
      try {
        await apiFetch<{ success: true }>("/api/business", {
          method: "PATCH",
          body: JSON.stringify({ revenueInsightsEnabled: nextEnabled }),
        });

        queryClient.setQueryData(["business"], (prev: any) => ({
          ...(prev || {}),
          revenueInsightsEnabled: nextEnabled,
        }));
        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        queryClient.removeQueries({ queryKey: ["dashboardRevenueSeries"] });

        setEnabled(nextEnabled);
        toast.success(
          nextEnabled
            ? t("settings.revenueInsightsEnabledToast")
            : t("settings.revenueInsightsDisabledToast"),
        );
      } catch (err: any) {
        toast.error(err?.message || t("errors.failedToSave"));
        setEnabled(Boolean(business?.revenueInsightsEnabled));
      } finally {
        setSaving(false);
      }
    },
    [business?.revenueInsightsEnabled, queryClient, t],
  );

  const onToggleChange = (checked: boolean) => {
    if (saving) return;
    if (checked) {
      setConfirmOpen(true);
      return;
    }
    persist(false);
  };

  const showFullPageSpinner = isPending && !business;
  const showErrorState = isError && !business && !isPending && !isFetching;

  if (showFullPageSpinner) {
    return <CenteredSpinner fullPage />;
  }

  if (showErrorState) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("settings.insightsTitle")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("settings.insightsSubtitle")}
          </p>
        </div>
        <div className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : t("errors.failedToLoad")}
        </div>
        <div>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("settings.insightsTitle")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("settings.insightsSubtitle")}
        </p>
      </div>

      <Card className="gap-0 py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("settings.revenueInsightsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t("settings.revenueInsightsDescription")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {enabled
                  ? t("settings.revenueInsightsToggleOn")
                  : t("settings.revenueInsightsToggleOff")}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={onToggleChange}
                disabled={saving}
                aria-label={t("settings.revenueInsightsTitle")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>
              {t("settings.revenueInsightsConsentTitle")}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {t("settings.revenueInsightsConsentBody")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3">
            <Checkbox
              id="revenue-insights-consent"
              checked={consentChecked}
              onCheckedChange={(value) => setConsentChecked(Boolean(value))}
              disabled={saving}
            />
            <label
              htmlFor="revenue-insights-consent"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {t("settings.revenueInsightsConsentAgree")}
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setConfirmOpen(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-2xl"
              onClick={() => persist(true)}
              disabled={!consentChecked || saving}
            >
              {saving
                ? t("common.loading")
                : t("settings.revenueInsightsEnableCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
