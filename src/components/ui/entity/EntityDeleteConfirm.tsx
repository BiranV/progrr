"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function EntityDeleteConfirm({
    title,
    description,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    confirmVariant = "destructive",
    confirmClassName,
    onCancel,
    onConfirm,
    disabled,
    cancelDisabled,
    confirmDisabled,
    className,
}: {
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    confirmClassName?: string;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    disabled?: boolean;
    cancelDisabled?: boolean;
    confirmDisabled?: boolean;
    className?: string;
}) {
    const cancelIsDisabled = disabled ?? cancelDisabled ?? false;
    const confirmIsDisabled = disabled ?? confirmDisabled ?? false;

    return (
        <div
            className={
                className ??
                "p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg space-y-3"
            }
        >
            <div className="space-y-1">
                <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                    {title}
                </div>
                <div className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                    {description}
                </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={cancelIsDisabled}
                    onClick={onCancel}
                >
                    {cancelLabel}
                </Button>
                <Button
                    variant={confirmVariant}
                    size="sm"
                    type="button"
                    disabled={confirmIsDisabled}
                    className={confirmClassName}
                    onClick={() => void onConfirm()}
                >
                    {confirmLabel}
                </Button>
            </div>
        </div>
    );
}
