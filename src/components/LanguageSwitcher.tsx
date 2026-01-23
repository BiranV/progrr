"use client";

import React from "react";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";

export default function LanguageSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
    const { language, dir, updateUserLanguage } = useLocale();
    const { t } = useI18n();
    const isDark = variant === "dark";

    return (
        <div
            className={
                "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold backdrop-blur-md " +
                (isDark
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-gray-200 bg-white text-gray-900") +
                (dir === "rtl" ? " flex-row-reverse" : "")
            }
            aria-label={t("common.languageSwitcher")}
        >
            <button
                type="button"
                onClick={() => updateUserLanguage("he")}
                className={
                    "rounded-full px-2 py-1 transition " +
                    (language === "he"
                        ? isDark
                            ? "bg-white text-neutral-900"
                            : "bg-neutral-900 text-white"
                        : isDark
                            ? "text-white/80 hover:text-white"
                            : "text-gray-600 hover:text-gray-900")
                }
                aria-pressed={language === "he"}
            >
                {t("common.languageHebrew")}
            </button>
            <span className={isDark ? "text-white/60" : "text-gray-400"}>|</span>
            <button
                type="button"
                onClick={() => updateUserLanguage("en")}
                className={
                    "rounded-full px-2 py-1 transition " +
                    (language === "en"
                        ? isDark
                            ? "bg-white text-neutral-900"
                            : "bg-neutral-900 text-white"
                        : isDark
                            ? "text-white/80 hover:text-white"
                            : "text-gray-600 hover:text-gray-900")
                }
                aria-pressed={language === "en"}
            >
                {t("common.languageEnglish")}
            </button>
        </div>
    );
}
