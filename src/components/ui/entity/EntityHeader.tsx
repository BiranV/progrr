"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export function EntityHeader({
    title,
    subtitle,
    status,
    onEdit,
    editIcon: EditIcon,
    editLabel = "Edit",
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    status?: React.ReactNode;
    onEdit?: () => void;
    editIcon?: LucideIcon;
    editLabel?: string;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                    {title}
                </div>
                {subtitle ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {subtitle}
                    </div>
                ) : null}
            </div>

            {status ? status : null}

            {onEdit ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                    {EditIcon ? <EditIcon className="w-4 h-4 mr-2" /> : null}
                    {editLabel}
                </Button>
            ) : null}
        </div>
    );
}
