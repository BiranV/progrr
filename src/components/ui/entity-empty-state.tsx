"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EntityEmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
}) {
    return (
        <Card>
            <CardContent className="py-12 text-center">
                <Icon className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-4" />
                <div className="text-gray-900 dark:text-white font-medium">{title}</div>
                {description ? (
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                ) : null}
            </CardContent>
        </Card>
    );
}
