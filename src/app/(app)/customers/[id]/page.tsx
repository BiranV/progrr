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

function statusBadgeVariant(status: Booking["status"]) {
  if (status === "BOOKED") {
    return { label: "BOOKED", className: "bg-emerald-600 text-white" };
  }
  if (status === "COMPLETED") {
    return { label: "COMPLETED", className: "bg-blue-600 text-white" };
  }
  if (status === "NO_SHOW") {
    return { label: "NO SHOW", className: "bg-amber-600 text-white" };
  }
  return { label: "CANCELED", className: "bg-gray-500 text-white dark:bg-gray-700" };
}

export default function CustomerDetailsPage() {
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
        throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json as CustomerDetailsResponse);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [bookingsPage, id]);

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
      throw new Error(json?.error || `Request failed (${res.status})`);
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
        throw new Error(json?.error || `Request failed (${res.status})`);
      setSubject("");
      setMessage("");
    } catch (e: any) {
      setError(e?.message || "Failed");
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
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success(
        action === "block"
          ? "Customer blocked"
          : "Customer unblocked"
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
      setError(e?.message || "Failed");
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
          label="Customers"
          ariaLabel="Back to Customers"
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
          label="Customers"
          ariaLabel="Back to Customers"
        />
        <div className="text-sm text-muted-foreground">Not found.</div>
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
          confirmAction === "block" ? "Block customer?" : "Confirm"
        }
        description={
          confirmAction === "block"
            ? "This customer will be blocked from making new bookings."
            : undefined
        }
        confirmText={
          confirmAction === "block" ? "Block" : "Confirm"
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
          label="Customers"
          ariaLabel="Back to Customers"
        />
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold text-gray-900 dark:text-white truncate">
            {data.customer.fullName || "Customer"}
          </h1>

          <Badge
            className={
              "shrink-0 text-white " +
              (String(data.customer.status ?? "ACTIVE") === "BLOCKED"
                ? "bg-rose-600"
                : "bg-emerald-600")
            }
          >
            {String(data.customer.status ?? "ACTIVE")}
          </Badge>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-tight space-y-0.5">
          <div className="truncate">{data.customer.phone}</div>
          {data.customer.email ? (
            <div className="truncate">{data.customer.email}</div>
          ) : null}
          <div>{`Active bookings: ${data.activeBookingsCount}`}</div>
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
              Unblock
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
              Block
            </Button>
          )}
        </div>

        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          Send message
        </div>
        <Input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          placeholder="Message"
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
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            Booking history
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
                aria-label="Newer bookings"
                title="Newer"
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
                aria-label="Older bookings"
                title="Older"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        {data.bookings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No bookings.</div>
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
                        {b.startTime}–{b.endTime}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {b.serviceName}
                      </div>

                      {b.status === "CANCELED" ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {String(b.cancelledBy || "").toUpperCase() === "BUSINESS"
                            ? "Canceled by you"
                            : String(b.cancelledBy || "").toUpperCase() === "CUSTOMER"
                              ? "Canceled by customer"
                              : "Canceled"}
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
                            Cancel
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
                Showing {pageSize} per page • Total {data.bookingsPagination.totalBookingsCount}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
