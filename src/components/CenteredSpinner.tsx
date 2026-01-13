import React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function CenteredSpinner({
    fullPage,
    className,
    size = "md",
}: {
    fullPage?: boolean;
    className?: string;
    size?: "sm" | "md" | "lg";
}) {
    const iconClass =
        size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";

    return (
        <div
            className={cn(
                fullPage
                    ? "min-h-[70vh] w-full flex items-center justify-center"
                    : "w-full flex justify-center",
                className
            )}
            aria-busy="true"
            aria-live="polite"
        >
            <Loader2 className={cn(iconClass, "animate-spin text-gray-500 dark:text-gray-300")} />
        </div>
    );
}
