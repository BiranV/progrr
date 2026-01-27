"use client";

import React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { useI18n } from "@/i18n/useI18n";

export default function PublicReviewPage() {
  const { t } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const publicId = String((params as any)?.publicId ?? "").trim();
  const reviewToken = String(searchParams.get("reviewToken") ?? "").trim();

  const link = publicId
    ? `/b/${publicId}${reviewToken ? `?reviewToken=${encodeURIComponent(reviewToken)}` : ""}`
    : "/";

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        {t("reviewPage.title")}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t("reviewPage.unavailableDescription")}
      </p>
      <Link href={link} className="text-sm underline underline-offset-4">
        {t("reviewPage.publicLink")}
      </Link>
    </div>
  );
}
