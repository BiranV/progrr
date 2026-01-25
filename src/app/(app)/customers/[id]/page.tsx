"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SettingsBackHeader from "@/components/settings/SettingsBackHeader";
import { toast } from "sonner";
import { useI18n } from "@/i18n/useI18n";
import { formatTimeRange } from "@/lib/utils";

type Booking = {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "BOOKED" | "CANCELED" | "COMPLETED" | "NO_SHOW";
  cancelledBy?: "BUSINESS" | "CUSTOMER" | string;
};

type CustomerDetailsResponse = {
  ok: true;
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    status?: "ACTIVE" | "BLOCKED";
    isHidden?: boolean;
  };
  activeBookingsCount: number;
  bookings: Booking[];
  bookingsPagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalBookingsCount: number;
  };
};

export default function CustomerDetailsPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = String((params as any)?.id ?? "");

  const queryClient = useQueryClient();

  const [bookingsPage, setBookingsPage] = React.useState(1);
  const pageSize = 10;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<CustomerDetailsResponse | null>(null);

  const [sending, setSending] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [confirmAction, setConfirmAction] = React.useState<"block" | null>(null);
  const [updatingCustomer, setUpdatingCustomer] = React.useState<
    "block" | "unblock" | null
  >(null);

  const statusBadgeVariant = React.useCallback(
    (status: Booking["status"]) => {
      if (status === "BOOKED") {
        return {
          label: t("customers.details.status.booked"),
          className: "border backdrop-blur-sm bg-emerald-50/80 text-emerald-700 border-emerald-200/70",
        };
      }
      if (status === "COMPLETED") {
        return {
          label: t("customers.details.status.completed"),
          className: "border backdrop-blur-sm bg-blue-50/80 text-blue-700 border-blue-200/70",
        };
      }
      if (status === "NO_SHOW") {
        return {
          label: t("customers.details.status.noShow"),
          className: "border backdrop-blur-sm bg-amber-50/80 text-amber-700 border-amber-200/70",
        };
      }
      return {
        label: t("customers.details.status.canceled"),
        className:
          "border backdrop-blur-sm bg-gray-100/80 text-gray-600 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60",
      };
    },
    [t]
  );

  const prevCustomerIdRef = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customers/${encodeURIComponent(id)}?page=${encodeURIComponent(
          String(bookingsPage)
        )}&pageSize=${encodeURIComponent(String(pageSize))}`
      );
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status })
        );
      setData(json as CustomerDetailsResponse);
    } catch (e: any) {
      setError(e?.message || t("errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [bookingsPage, id, t]);

  React.useEffect(() => {
    if (!id) return;

    if (prevCustomerIdRef.current !== id) {
      prevCustomerIdRef.current = id;
      // Only reset pagination when moving between customers.
      // Important: don't return unconditionally here, otherwise the initial load
      // can be skipped (and the page stays stuck on the spinner in production).
      if (bookingsPage !== 1) {
        setBookingsPage(1);
        return;
      }
    }

    load();
  }, [id, bookingsPage, load]);

  const cancelBooking = async (bookingId: string) => {
    const res = await fetch(
      `/api/appointments/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: "POST",
      }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.error || t("errors.requestFailed", { status: res.status })
      );
    await load();
  };

  const sendMessage = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customers/${encodeURIComponent(id)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, message }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status })
        );
      setSubject("");
      setMessage("");
    } catch (e: any) {
      setError(e?.message || t("errors.failedToSave"));
    } finally {
      setSending(false);
    }
  };

  const updateCustomer = async (action: "block" | "unblock") => {
    setError(null);
    try {
      setUpdatingCustomer(action);

      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status })
        );
      }

      toast.success(
        action === "block"
          ? t("customers.details.toastBlocked")
          : t("customers.details.toastUnblocked")
      );

      // Keep the customers list in sync when navigating back.
      const nextStatus = action === "block" ? "BLOCKED" : "ACTIVE";
      setData((prev) =>
        prev
          ? {
            ...prev,
            customer: {
              ...prev.customer,
              status: nextStatus as any,
            },
          }
          : prev
      );

      queryClient.setQueryData(["customers"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((c: any) => {
          const cid = String(c?._id ?? c?.id ?? "");
          if (!cid || cid !== id) return c;
          return { ...c, status: nextStatus };
        });
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      await load();
    } catch (e: any) {
      setError(e?.message || t("errors.failedToSave"));
    } finally {
      setUpdatingCustomer(null);
    }
  };

  const isInitialLoading = loading && !data;
  const isRefreshing = loading && !!data;

  if (isInitialLoading) {
    return <CenteredSpinner fullPage />;
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <SettingsBackHeader
          href="/customers"
          label={t("customers.title")}
          ariaLabel={t("customers.details.backToCustomers")}
        />
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="space-y-4">
        <SettingsBackHeader
          href="/customers"
          label={t("customers.title")}
          ariaLabel={t("customers.details.backToCustomers")}
        />
        <div className="text-sm text-muted-foreground">
          {t("customers.details.notFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction === "block"
            ? t("customers.details.confirmBlockTitle")
            : t("customers.details.confirmDefaultTitle")
        }
        description={
          confirmAction === "block"
            ? t("customers.details.confirmBlockDescription")
            : undefined
        }
        confirmText={
          confirmAction === "block"
            ? t("customers.details.confirmBlockAction")
            : t("customers.details.confirmDefaultAction")
        }
        confirmVariant="destructive"
        loading={confirmAction ? updatingCustomer === confirmAction : false}
        onConfirm={async () => {
          if (!confirmAction) return;
          const action = confirmAction;
          await updateCustomer(action);
        }}
      />

      <div className="space-y-2">
        <SettingsBackHeader
          href="/customers"
          label={t("customers.title")}
          ariaLabel={t("customers.details.backToCustomers")}
        />
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold text-gray-900 dark:text-white truncate">
            {data.customer.fullName || t("customers.details.customerFallback")}
          </h1>

          <Badge
            className={
              "shrink-0 border backdrop-blur-sm " +
              (String(data.customer.status ?? "ACTIVE") === "BLOCKED"
                ? "bg-rose-50/80 text-rose-700 border-rose-200/70"
                : "bg-emerald-50/80 text-emerald-700 border-emerald-200/70")
            }
          >
            {String(data.customer.status ?? "ACTIVE") === "BLOCKED"
              ? t("customers.details.status.blocked")
              : t("customers.details.status.active")}
          </Badge>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-tight space-y-0.5">
          <div className="truncate">{data.customer.phone}</div>
          {data.customer.email ? (
            <div className="truncate">{data.customer.email}</div>
          ) : null}
          <div>
            {t("customers.details.activeBookings", {
              count: data.activeBookingsCount,
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {String(data.customer.status ?? "ACTIVE") === "BLOCKED" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => updateCustomer("unblock")}
              disabled={updatingCustomer === "unblock"}
            >
              {t("customers.details.unblock")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setConfirmAction("block")}
              disabled={Boolean(updatingCustomer)}
            >
              {t("customers.details.block")}
            </Button>
          )}
        </div>

        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("customers.details.sendMessageTitle")}
        </div>
        <Input
          placeholder={t("customers.details.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          placeholder={t("customers.details.messagePlaceholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={sendMessage}
          disabled={sending || !subject.trim() || !message.trim()}
        >
          {sending
            ? t("customers.details.sendingMessage")
            : t("customers.details.sendMessage")}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("customers.details.bookingHistory")}
          </div>

          {data.bookingsPagination ? (
            <div className="flex items-center gap-1">
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground me-1" />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                disabled={loading || data.bookingsPagination.page <= 1}
                aria-label={t("customers.details.newerBookings")}
                title={t("customers.details.newer")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-xs text-muted-foreground min-w-[72px] text-center">
                {data.bookingsPagination.page}/{data.bookingsPagination.totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() =>
                  setBookingsPage((p) =>
                    Math.min(data.bookingsPagination!.totalPages, p + 1)
                  )
                }
                disabled={
                  loading ||
                  data.bookingsPagination.page >= data.bookingsPagination.totalPages
                }
                aria-label={t("customers.details.olderBookings")}
                title={t("customers.details.older")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        {data.bookings.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("customers.details.noBookings")}
          </div>
        ) : (
          <>
            {data.bookings.map((b) => {
              const badge = statusBadgeVariant(b.status);
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {b.date}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        <span dir="ltr">
                          {formatTimeRange(b.startTime, b.endTime)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {b.serviceName}
                      </div>

                      {b.status === "CANCELED" ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {String(b.cancelledBy || "").toUpperCase() === "BUSINESS"
                            ? t("customers.details.canceledBy.business")
                            : String(b.cancelledBy || "").toUpperCase() === "CUSTOMER"
                              ? t("customers.details.canceledBy.customer")
                              : t("customers.details.canceledBy.unknown")}
                        </div>
                      ) : null}

                      {b.status === "BOOKED" ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                            onClick={() => cancelBooking(b.id)}
                          >
                            {t("customers.details.cancel")}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </div>
              );
            })}

            {data.bookingsPagination ? (
              <div className="text-xs text-muted-foreground">
                {t("customers.details.paginationSummary", {
                  pageSize,
                  total: data.bookingsPagination.totalBookingsCount,
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
