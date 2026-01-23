"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function SettingsBackHeader({
  href = "/settings",
  label = "Settings",
  ariaLabel,
}: {
  href?: string;
  label?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        onClick={() => router.push(href)}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer text-start"
        aria-label={ariaLabel || `Back to ${label}`}
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        <span>{label}</span>
      </button>
    </div>
  );
}
