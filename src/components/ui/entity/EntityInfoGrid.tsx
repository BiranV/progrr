"use client";

import * as React from "react";

export function EntityInfoGrid({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={
                "grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" +
                (className ? " " + className : "")
            }
        >
            {children}
        </div>
    );
}
