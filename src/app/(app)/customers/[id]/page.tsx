"use client";

import React from "react";
import { useParams } from "next/navigation";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Button } from "@/components/ui/button";
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
  status: "ACTIVE" | "CANCELED" | "COMPLETED";
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
};

function statusBadgeVariant(status: Booking["status"]) {
  if (status === "ACTIVE")
    return { label: "ACTIVE", className: "bg-emerald-600" };
  if (status === "CANCELED")
    return { label: "CANCELED", className: "bg-rose-600" };
  return { label: "COMPLETED", className: "bg-gray-600" };
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const id = String((params as any)?.id ?? "");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<CustomerDetailsResponse | null>(null);

  const [sending, setSending] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json as CustomerDetailsResponse);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    load();
  }, [id, load]);

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

  const updateCustomer = async (action: "block" | "unblock" | "hide") => {
    setError(null);
    try {
      if (action === "hide") {
        const ok = window.confirm(
          "Remove this customer from your list? (They can reappear if they book again.)"
        );
        if (!ok) return;
      }

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
          : action === "unblock"
            ? "Customer unblocked"
            : "Customer removed"
      );

      if (action === "hide") {
        window.location.href = "/customers";
        return;
      }

      await load();
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  };

  if (loading) {
    return <CenteredSpinner fullPage />;
  }

  if (error) {
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
      <div className="space-y-2">
        <SettingsBackHeader
          href="/customers"
          label="Customers"
          ariaLabel="Back to Customers"
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.customer.fullName || "Customer"}
        </h1>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-tight space-y-0.5">
          <div className="truncate">{data.customer.phone}</div>
          {data.customer.email ? (
            <div className="truncate">{data.customer.email}</div>
          ) : null}
          <div>{`Active bookings: ${data.activeBookingsCount}`}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              String(data.customer.status ?? "ACTIVE") === "BLOCKED"
                ? "bg-rose-600"
                : "bg-emerald-600"
            }
          >
            {String(data.customer.status ?? "ACTIVE")}
          </Badge>
          {String(data.customer.status ?? "ACTIVE") === "BLOCKED" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => updateCustomer("unblock")}
            >
              Unblock
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => updateCustomer("block")}
            >
              Block
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => updateCustomer("hide")}
          >
            Remove from list
          </Button>
        </div>
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
          onClick={sendMessage}
          disabled={sending || !subject.trim() || !message.trim()}
        >
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          Booking history
        </div>
        {data.bookings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No bookings.</div>
        ) : (
          data.bookings.map((b) => {
            const badge = statusBadgeVariant(b.status);
            return (
              <div
                key={b.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {b.serviceName}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {b.date} • {b.startTime}–{b.endTime}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={badge.className}>{badge.label}</Badge>
                  {b.status === "ACTIVE" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cancelBooking(b.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
