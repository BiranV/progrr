"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export type AuthBannerState =
    | { type: "error"; text: string }
    | { type: "message"; text: string }
    | null;

export default function AuthBanner({ banner }: { banner: AuthBannerState }) {
    if (!banner) return null;

    const isError = banner.type === "error";

    return (
        <div
            className={
                isError
                    ? "flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12"
                    : "flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12"
            }
        >
            <div
                className={
                    isError
                        ? "inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300"
                        : "inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                }
            >
                {isError ? (
                    <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                ) : (
                    <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                )}
            </div>
            <div className="min-w-0">
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                    {banner.text}
                </div>
            </div>
        </div>
    );
}
