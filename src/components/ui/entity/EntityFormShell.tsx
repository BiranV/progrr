"use client";

import * as React from "react";
import { XCircle } from "lucide-react";

export function EntityFormShell({
    id,
    onSubmit,
    validationError,
    children,
    className = "space-y-4",
}: {
    id: string;
    onSubmit: (e: React.FormEvent) => void;
    validationError?: string | null;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <form id={id} onSubmit={onSubmit} noValidate className={className}>
            {validationError ? (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 min-h-12 py-2">
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
                        <XCircle className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                            {validationError}
                        </div>
                    </div>
                </div>
            ) : null}

            {children}
        </form>
    );
}
