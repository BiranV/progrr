"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PublicVerifyContent({
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
    const phone = String(searchParams.get("phone") ?? "").trim();
    const qs = new URLSearchParams();
    if (phone) qs.set("phone", phone);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(raw)}${qsString ? `?${qsString}` : ""}`
    );
  }, [raw, router, searchParams]);

  return null;
}

export default function PublicVerifyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <PublicVerifyContent params={params} />
    </Suspense>
  );
}
