"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrimaryAction = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
};

export function EntityPageLayout({
    title,
    subtitle,
    primaryAction,
    secondaryActions,
    children,
    className,
}: {
    title: string;
    subtitle?: string;
    primaryAction?: PrimaryAction;
    secondaryActions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen", className)}>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    {subtitle ? (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
                    ) : null}
                </div>

                {primaryAction || secondaryActions ? (
                    <div className="flex items-center gap-2">
                        {secondaryActions}
                        {primaryAction ? (
                            <Button
                                type="button"
                                onClick={primaryAction.onClick}
                                disabled={primaryAction.disabled}
                                className="min-w-[140px] bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {primaryAction.label}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {children}
        </div>
    );
}
