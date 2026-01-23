"use client";

import * as React from "react";

import { Progress } from "@/components/ui/progress";

export default function ProgressBar({
    progress,
    stepCountLabel,
}: {
    progress: number;
    stepCountLabel: string;
}) {
    return (
        <div className="pt-4 max-w-xs mx-auto w-full">
            <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
                <span>{stepCountLabel}</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <Progress
                value={progress}
                className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 [&>div]:bg-neutral-900 rounded-full"
            />
        </div>
    );
}
