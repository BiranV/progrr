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
      className={`
                flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-md shadow-sm mb-4
                ${
                  isError
                    ? "bg-red-500/10 border-red-500/20 text-white"
                    : "bg-emerald-500/10 border-emerald-500/20 text-white"
                }
            `}
    >
      {/* Icons */}
      {isError ? (
        <XCircle className="h-5 w-5 text-red-200 shrink-0" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-emerald-200 shrink-0" />
      )}
      <p className="text-sm font-medium leading-tight">{banner.text}</p>
    </div>
  );
}
