"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusiness } from "@/hooks/useBusiness";
import React from "react";
import { toast } from "sonner";

export default function DashboardPage() {
  const { data: business } = useBusiness();
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");

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
      setCopyStatus("copied");
      toast.success("Copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      toast.error("Failed to share");
    }
  }, [bookingLink]);

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
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              Today&apos;s appointments
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              0
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              Upcoming appointments
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              0
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total customers</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              0
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Business status</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Open
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2) Public booking link */}
      <Card>
        <CardHeader>
          <CardTitle>Public booking link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input readOnly value={bookingLink} placeholder="Loading…" />
          <Button type="button" onClick={onShare} disabled={!bookingLink}>
            {copyStatus === "copied" ? "Copied!" : "Share booking link"}
          </Button>
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
