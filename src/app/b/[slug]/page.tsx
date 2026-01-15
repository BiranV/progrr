"use client";

import React from "react";
import PublicBookingFlow from "./_components/PublicBookingFlow";

export default function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();

  return <PublicBookingFlow publicIdOrSlug={raw} />;
}
