"use client";

import { X } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";

export type AuthBannerState =
  | { type: "error"; text: string }
  | { type: "message"; text: string }
  | null;

export default function AuthBanner({
  banner,
  onClose,
}: {
  banner: AuthBannerState;
  onClose?: () => void;
}) {
  if (!banner) return null;

  const isError = banner.type === "error";
  const { t } = useI18n();

  return (
    <div
      className={`
                flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm mb-4 text-start
                ${isError
          ? "bg-[#FDE8EC] border-[#FDE8EC] text-[#B42318]"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }
            `}
    >
      <p className="text-sm font-medium leading-tight flex-1">{banner.text}</p>

      {onClose && !isError ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("auth.dismissAlert")}
          className={
            (isError
              ? "-m-1 rounded-md p-1 text-[#B42318]/70 hover:text-[#B42318] hover:bg-[#B42318]/10"
              : "-m-1 rounded-md p-1 text-emerald-600/70 hover:text-emerald-700 hover:bg-emerald-100") +
            " ms-auto"
          }
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
