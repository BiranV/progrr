"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function PublicSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();

  React.useEffect(() => {
    if (!raw) return;
    router.replace(`/b/${encodeURIComponent(raw)}`);
  }, [raw, router]);

  return null;
}
