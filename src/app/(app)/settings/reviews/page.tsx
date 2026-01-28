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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { Star, Trash2 } from "lucide-react";

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

type ReviewsResponse = {
  ok: true;
  reviews: ReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_DELAY_MINUTES = 15;

type ReviewFormState = {
  enabled: boolean;
  delayMinutes: number;
  requiresPayment: boolean;
};

function serializeState(state: ReviewFormState): string {
  return JSON.stringify({
    enabled: state.enabled,
    delayMinutes: state.delayMinutes,
    requiresPayment: state.requiresPayment,
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
    requiresPayment: true,
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof ReviewFormState, string>>
  >({});
  const [isSaving, setIsSaving] = React.useState(false);
  const initialRef = React.useRef<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ReviewItem | null>(
    null,
  );
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(5);
  const [selectedRating, setSelectedRating] = React.useState<number | null>(
    null,
  );
  const [allReviews, setAllReviews] = React.useState<ReviewItem[]>([]);

  React.useEffect(() => {
    setPage(1);
  }, [pageSize, selectedRating]);

  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ReviewsResponse> => {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        range: "last7days",
      });
      const res = await fetch(`/api/reviews?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error || t("errors.failedToLoad"));
      }
      return json as ReviewsResponse;
    },
  });

  React.useEffect(() => {
    if (!reviewsQuery.data?.reviews) return;
    setAllReviews(reviewsQuery.data.reviews);
  }, [reviewsQuery.data]);

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
      requiresPayment:
        typeof business.reviewRequiresPayment === "boolean"
          ? business.reviewRequiresPayment
          : true,
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

  const updateInitialEnabled = (enabled: boolean) => {
    if (!initialRef.current) {
      initialRef.current = serializeState({
        ...form,
        enabled,
      });
      return;
    }

    try {
      const parsed = JSON.parse(initialRef.current) as ReviewFormState;
      initialRef.current = serializeState({
        enabled,
        delayMinutes: parsed.delayMinutes,
        requiresPayment: parsed.requiresPayment,
      });
    } catch {
      initialRef.current = serializeState({
        ...form,
        enabled,
      });
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    updateField("enabled", checked);
    if (isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewRequestsEnabled: checked,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }

      queryClient.setQueryData(["business"], (prev: any) => ({
        ...(prev || {}),
        reviewRequestsEnabled: checked,
      }));
      updateInitialEnabled(checked);
    } catch (e: any) {
      updateField("enabled", !checked);
      toast.error(String(e?.message || t("errors.failedToSave")));
    } finally {
      setIsSaving(false);
    }
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
          reviewRequiresPayment: form.requiresPayment,
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
        reviewRequiresPayment: form.requiresPayment,
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

  const settingsDisabled = !form.enabled;

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
    setAllReviews((prev) => prev.filter((r) => r.id !== review.id));
    toast.success(t("reviews.toastDeleted"));
  };

  const renderRatingStars = (rating: number) => {
    const safe = Number.isFinite(rating) ? rating : 0;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const active = safe >= index + 1;
          return (
            <Star
              key={`star-${index}`}
              className={
                "h-4 w-4 " +
                (active
                  ? "text-amber-500 fill-amber-500"
                  : "text-gray-300 dark:text-gray-600")
              }
            />
          );
        })}
      </div>
    );
  };

  const reviewColumns = React.useMemo(() => {
    const cols: Array<DataTableColumn<ReviewItem>> = [
      {
        key: "review",
        header: t("reviews.listTitle"),
        renderCell: (review) => (
          <div className="min-w-0 space-y-2">
            <div className="font-semibold text-gray-900 dark:text-white truncate">
              {review.serviceName || t("reviews.serviceFallback")}
            </div>
            <div className="flex items-center gap-2">
              {renderRatingStars(review.rating)}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Number.isFinite(review.rating)
                  ? review.rating.toFixed(1)
                  : t("common.emptyDash")}
              </span>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {review.comment || t("common.emptyDash")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {review.customerName || t("common.emptyDash")}
            </div>
          </div>
        ),
      },
      {
        key: "actions",
        header: "",
        headerClassName: "text-end",
        cellClassName: "w-[1%] whitespace-nowrap text-end",
        renderCell: (review) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(review)}
            aria-label={t("reviews.deleteAction")}
          >
            <Trash2 className="h-4 w-4 text-gray-900 dark:text-white" />
          </Button>
        ),
      },
    ];

    return cols;
  }, [t]);

  const showFullPageSpinner = isPending && !business && !initialRef.current;
  const showErrorState =
    !business && !initialRef.current && isError && !isPending && !isFetching;

  const filteredReviews = React.useMemo(() => {
    return allReviews.filter((review) => {
      if (selectedRating && Math.round(review.rating) !== selectedRating) {
        return false;
      }
      return true;
    });
  }, [allReviews, selectedRating]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedReviews = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, page, pageSize]);

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
                onCheckedChange={handleToggleEnabled}
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
        <CardContent
          className={
            "pt-0 space-y-4" +
            (settingsDisabled ? " opacity-50 pointer-events-none" : "")
          }
        >
          <div className="space-y-2">
            <Label>{t("reviews.requiresPaymentLabel")}</Label>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200/70 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-200">
              <div className="space-y-1">
                <div className="font-medium">
                  {form.requiresPayment
                    ? t("reviews.requiresPaymentPaid")
                    : t("reviews.requiresPaymentCompleted")}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("reviews.requiresPaymentHelp")}
                </div>
              </div>
              <Switch
                checked={form.requiresPayment}
                onCheckedChange={(checked) =>
                  updateField("requiresPayment", checked)
                }
                disabled={isSaving || settingsDisabled}
                aria-label={t("reviews.requiresPaymentLabel")}
              />
            </div>
          </div>
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
              disabled={isSaving || settingsDisabled}
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
          <div className="rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
            {t("reviews.adminNotice")}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={selectedRating ? String(selectedRating) : "all"}
                onValueChange={(value) =>
                  setSelectedRating(value === "all" ? null : Number(value))
                }
              >
                <SelectTrigger size="sm" className="w-full text-start">
                  <SelectValue placeholder={t("reviews.ratingLabel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v) || 5)}
              >
                <SelectTrigger size="sm" className="w-full text-start">
                  <SelectValue placeholder={t("customers.table.rows")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">
                    {t("customers.table.rowsCount", { count: 5 })}
                  </SelectItem>
                  <SelectItem value="10">
                    {t("customers.table.rowsCount", { count: 10 })}
                  </SelectItem>
                  <SelectItem value="25">
                    {t("customers.table.rowsCount", { count: 25 })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {reviewsQuery.isLoading ? (
            <CenteredSpinner size="sm" className="py-6" />
          ) : reviewsQuery.isError ? (
            <div className="text-sm text-rose-500">
              {(reviewsQuery.error as Error)?.message ||
                t("errors.failedToLoad")}
            </div>
          ) : (
            <DataTable
              rows={pagedReviews}
              columns={reviewColumns}
              getRowId={(row) => row.id}
              emptyMessage={
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("reviews.listEmpty")}
                </div>
              }
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
              }}
              paginationLabels={{
                summary: (pageValue, totalPagesValue) =>
                  t("customers.table.paginationSummary", {
                    page: pageValue,
                    total: totalPagesValue,
                  }),
                previous: t("customers.table.previous"),
                next: t("customers.table.next"),
              }}
            />
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
