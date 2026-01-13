"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/public-booking";
import PublicBookingShell from "./_components/PublicBookingShell";
import { usePublicBusiness } from "./_components/usePublicBusiness";

export default function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();

  const { slug } = React.use(params);
  const normalizedSlug = String(slug ?? "").trim();

  const { data, loading, error } = usePublicBusiness(normalizedSlug);

  return (
    <PublicBookingShell
      business={data}
      title="Booking"
      subtitle={data?.business?.address || "Choose a service"}
      showGallery
    >
      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600 dark:text-gray-300">
            Loading…
          </CardContent>
        </Card>
      ) : error || !data ? (
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-600 dark:text-red-400">
              {error || "Business not found"}
            </div>
            <Button
              variant="outline"
              onClick={() => router.refresh()}
              className="rounded-2xl"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Select service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.services.map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  router.push(
                    `/b/${encodeURIComponent(
                      normalizedSlug
                    )}/calendar?serviceId=${encodeURIComponent(s.id)}`
                  )
                }
                className="w-full text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 hover:bg-white dark:hover:bg-gray-900/30 transition shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {s.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {s.durationMinutes} min
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white shrink-0">
                    {formatPrice({
                      price: s.price,
                      currency: data.currency,
                    })}
                  </div>
                </div>
              </button>
            ))}

            {!data.services.length && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                No services available.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PublicBookingShell>
  );
}
