"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PublicCalendarContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();

  React.useEffect(() => {
    if (!raw) return;
    const serviceId = String(searchParams.get("serviceId") ?? "").trim();
    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(raw)}${qsString ? `?${qsString}` : ""}`
    );
  }, [raw, router, searchParams]);

  return null;
}

export default function PublicCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <PublicCalendarContent params={params} />
    </Suspense>
  );
}
