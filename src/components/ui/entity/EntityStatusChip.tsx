"use client";

import * as React from "react";

function normalizeStatus(status: unknown) {
    return String(status ?? "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-");
}

function toLabel(status: string) {
    const raw = status.replace(/[-_]/g, " ").trim();
    if (!raw) return "Unknown";
    return raw
        .split(/\s+/g)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
}

export function EntityStatusChip({
    status,
    size = "md",
    className,
}: {
    status: string;
    size?: "sm" | "md";
    className?: string;
}) {
    const s = normalizeStatus(status);

    const classes = React.useMemo(() => {
        // Entity lifecycle-ish
        if (s === "archived") {
            return "border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-200";
        }
        if (s === "deleted") {
            return "border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-900/10 dark:border-rose-800 dark:text-rose-200";
        }
        if (s === "inactive") {
            return "border border-gray-200 bg-gray-50 text-gray-700 dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-200";
        }
        if (s === "pending") {
            return "border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-200";
        }
        if (s === "pending-limit") {
            return "border border-indigo-200 bg-indigo-50 text-indigo-800 dark:bg-indigo-900/10 dark:border-indigo-800 dark:text-indigo-200";
        }
        if (s === "blocked") {
            return "border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-900/10 dark:border-rose-800 dark:text-rose-200";
        }
        if (s === "active") {
            return "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-200";
        }

        // Meeting-ish
        if (s === "scheduled") {
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
        }
        if (s === "completed") {
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
        }
        if (s === "cancelled" || s === "canceled") {
            return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
        }
        if (s === "no-show" || s === "no show") {
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200";
        }

        return "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-200";
    }, [s]);

    return (
        <span
            className={
                "inline-flex items-center font-medium capitalize " +
                (size === "sm"
                    ? "text-[11px] px-2 py-0.5 rounded "
                    : "h-7 px-3 rounded-md text-xs ") +
                classes +
                (className ? " " + className : "")
            }
        >
            {toLabel(s)}
        </span>
    );
}
