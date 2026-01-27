"use client";

import React from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useBusiness } from "@/hooks/useBusiness";
import { useI18n } from "@/i18n/useI18n";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";

type ReviewItem = {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  submittedAt: string | null;
};

const DEFAULT_DELAY_MINUTES = 15;

type ReviewFormState = {
  enabled: boolean;
  delayMinutes: number;
};

function serializeState(state: ReviewFormState): string {
  return JSON.stringify({
    enabled: state.enabled,
    delayMinutes: state.delayMinutes,
  });
}

export default function ReviewsSettingsPage() {
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

  const [form, setForm] = React.useState<ReviewFormState>({
    enabled: true,
    delayMinutes: DEFAULT_DELAY_MINUTES,
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof ReviewFormState, string>>
  >({});
  const [isSaving, setIsSaving] = React.useState(false);
  const initialRef = React.useRef<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ReviewItem | null>(
    null,
  );

  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<{ ok: true; reviews: ReviewItem[] }> => {
      const res = await fetch("/api/reviews", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || t("errors.failedToLoad"));
      }
      return json as { ok: true; reviews: ReviewItem[] };
    },
  });

  React.useEffect(() => {
    if (!business) return;
    const next: ReviewFormState = {
      enabled:
        typeof business.reviewRequestsEnabled === "boolean"
          ? business.reviewRequestsEnabled
          : true,
      delayMinutes:
        typeof business.reviewDelayMinutes === "number"
          ? business.reviewDelayMinutes
          : DEFAULT_DELAY_MINUTES,
    };

    setForm((prev) => {
      if (initialRef.current && serializeState(prev) !== initialRef.current) {
        return prev;
      }
      if (!initialRef.current) return next;
      if (serializeState(prev) === serializeState(next)) return prev;
      return next;
    });

    if (!initialRef.current) {
      initialRef.current = serializeState(next);
    }
  }, [business, t]);

  const updateField = <K extends keyof ReviewFormState>(
    key: K,
    value: ReviewFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof ReviewFormState, string>> = {};
    if (!Number.isFinite(form.delayMinutes) || form.delayMinutes < 0) {
      nextErrors.delayMinutes = t("reviews.errors.delayInvalid");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSave = async () => {
    if (isSaving) return;
    if (!validate()) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewRequestsEnabled: form.enabled,
          reviewDelayMinutes: Math.round(form.delayMinutes),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }

      queryClient.setQueryData(["business"], (prev: any) => ({
        ...(prev || {}),
        reviewRequestsEnabled: form.enabled,
        reviewDelayMinutes: Math.round(form.delayMinutes),
      }));
      initialRef.current = serializeState(form);
      toast.success(t("settings.toastSaved"));
    } catch (e: any) {
      toast.error(String(e?.message || t("errors.failedToSave")));
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    initialRef.current !== null &&
    serializeState(form) !== String(initialRef.current);

  const handleDeleteReview = async (review: ReviewItem) => {
    const res = await fetch(
      `/api/reviews?id=${encodeURIComponent(review.id)}`,
      {
        method: "DELETE",
      },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || t("errors.failedToSave"));
    }
    await queryClient.invalidateQueries({ queryKey: ["reviews"] });
    toast.success(t("reviews.toastDeleted"));
  };

  const showFullPageSpinner = isPending && !business && !initialRef.current;
  const showErrorState =
    !business && !initialRef.current && isError && !isPending && !isFetching;

  if (showFullPageSpinner) {
    return <CenteredSpinner fullPage />;
  }

  if (showErrorState) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("reviews.title")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("reviews.subtitle")}
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
          {t("reviews.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("reviews.subtitle")}
        </p>
      </div>

      <Card className="gap-0 py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("reviews.toggleTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t("reviews.toggleDescription")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {form.enabled ? t("reviews.toggleOn") : t("reviews.toggleOff")}
              </span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => updateField("enabled", checked)}
                disabled={isSaving}
                aria-label={t("reviews.toggleTitle")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("reviews.settingsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2">
            <Label>{t("reviews.delayLabel")}</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={Number.isFinite(form.delayMinutes) ? form.delayMinutes : 0}
              onChange={(e) =>
                updateField(
                  "delayMinutes",
                  e.target.value === "" ? 0 : Number(e.target.value),
                )
              }
              disabled={isSaving}
            />
            {errors.delayMinutes ? (
              <div className="text-xs text-rose-500">{errors.delayMinutes}</div>
            ) : null}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t("reviews.delayHelp")}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("reviews.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {reviewsQuery.isLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("common.loading")}
            </div>
          ) : reviewsQuery.isError ? (
            <div className="text-sm text-rose-500">
              {(reviewsQuery.error as Error)?.message ||
                t("errors.failedToLoad")}
            </div>
          ) : (reviewsQuery.data?.reviews?.length ?? 0) === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("reviews.listEmpty")}
            </div>
          ) : (
            <div className="space-y-4">
              {reviewsQuery.data?.reviews?.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-gray-200/70 p-4 dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {review.serviceName || t("reviews.serviceFallback")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {review.date}
                        {review.startTime && review.endTime
                          ? ` • ${review.startTime}–${review.endTime}`
                          : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(review)}
                    >
                      {t("reviews.deleteAction")}
                    </Button>
                  </div>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      <span className="font-medium">
                        {t("reviews.ratingLabel")}:
                      </span>{" "}
                      {Number.isFinite(review.rating)
                        ? review.rating.toFixed(1)
                        : "—"}
                    </div>
                    {review.comment ? (
                      <div className="mt-2 whitespace-pre-line">
                        <span className="font-medium">
                          {t("reviews.commentLabel")}:
                        </span>{" "}
                        {review.comment}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {t("reviews.customerLabel")}: {review.customerName || "—"}
                      {review.customerEmail ? ` • ${review.customerEmail}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-2">
        <Button
          type="button"
          className="w-full"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? t("common.loading") : t("settings.saveChanges")}
        </Button>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("reviews.deleteConfirmTitle")}
        description={t("reviews.deleteConfirmDescription")}
        confirmText={t("reviews.deleteConfirmAction")}
        cancelText={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await handleDeleteReview(deleteTarget);
        }}
      />
    </div>
  );
}
