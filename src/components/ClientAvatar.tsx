"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function getInitials(name: string): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";

  const parts = trimmed
    .split(/\s+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const word = parts[0];
    return word.slice(0, 2).toUpperCase();
  }

  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function ClientAvatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "shrink-0 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-100 font-semibold",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={name ? `Avatar for ${name}` : "Avatar"}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ? `Avatar for ${name}` : "Avatar"}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs leading-none">{initials || "?"}</span>
      )}
    </div>
  );
}
