"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrimaryAction = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
    disabledCta?: {
        label: string;
        href: string;
    };
};

type EntityPageLayoutProps = {
    title: string;
    subtitle?: string;
    primaryAction?: PrimaryAction;
    secondaryActions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
};

export function EntityPageLayout({
    title,
    subtitle,
    primaryAction,
    secondaryActions,
    children,
    className,
}: EntityPageLayoutProps) {
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
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        onClick={primaryAction.onClick}
                                        disabled={primaryAction.disabled}
                                        className="min-w-[140px] bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {primaryAction.disabled ? (
                                            <Lock className="h-4 w-4" aria-hidden="true" />
                                        ) : null}
                                        {primaryAction.label}
                                    </Button>

                                    {primaryAction.disabled && primaryAction.disabledCta ? (
                                        <Button asChild type="button" size="sm">
                                            <Link href={primaryAction.disabledCta.href}>
                                                {primaryAction.disabledCta.label}
                                            </Link>
                                        </Button>
                                    ) : null}
                                </div>

                                {primaryAction.disabled && primaryAction.disabledReason ? (
                                    <div className="max-w-[360px] text-right text-xs text-primary">
                                        {primaryAction.disabledReason}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {children}
        </div>
    );
}
