"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PublicTimesContent({
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
    const date = String(searchParams.get("date") ?? "").trim();
    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    if (date) qs.set("date", date);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(raw)}${qsString ? `?${qsString}` : ""}`
    );
  }, [raw, router, searchParams]);

  return null;
}

export default function PublicTimesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <PublicTimesContent params={params} />
    </Suspense>
  );
}
