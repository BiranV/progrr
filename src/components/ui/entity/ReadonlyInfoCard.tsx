"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

export function ReadonlyInfoCard({
    icon: Icon,
    label,
    value,
    className,
    iconClassName,
    labelClassName,
    valueClassName,
}: {
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    className?: string;
    iconClassName?: string;
    labelClassName?: string;
    valueClassName?: string;
}) {
    return (
        <div
            className={
                "rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2" +
                (className ? " " + className : "")
            }
        >
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Icon className={"w-4 h-4" + (iconClassName ? " " + iconClassName : "")} />
                <span className={labelClassName}>{label}</span>
            </div>
            <div
                className={
                    valueClassName ??
                    "mt-1 font-medium text-gray-900 dark:text-white"
                }
            >
                {value}
            </div>
        </div>
    );
}
