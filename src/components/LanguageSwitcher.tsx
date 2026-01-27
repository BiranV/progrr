"use client";

import React from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LanguageOption = {
  code: string;
  labelKey: string;
  flagSrc: string;
  disabled?: boolean;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "he", labelKey: "common.languageHebrew", flagSrc: "/flags/il.svg" },
  { code: "en", labelKey: "common.languageEnglish", flagSrc: "/flags/us.svg" },
  {
    code: "ru",
    labelKey: "common.languageRussian",
    flagSrc: "/flags/ru.svg",
    disabled: true,
  },
  {
    code: "ar",
    labelKey: "common.languageArabic",
    flagSrc: "/flags/sa.svg",
    disabled: true,
  },
];

export default function LanguageSwitcher({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const [mounted, setMounted] = React.useState(false);
  const { language, updateUserLanguage } = useLocale();
  const { t } = useI18n();
  const isDark = variant === "dark";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current =
    LANGUAGE_OPTIONS.find((opt) => opt.code === language) ||
    LANGUAGE_OPTIONS[1];

  if (!mounted) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-label={t("common.languageSwitcher")}
          className={
            "inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold backdrop-blur-md transition cursor-pointer " +
            (isDark
              ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50")
          }
        >
          <img
            src={current.flagSrc}
            alt=""
            className="h-3 w-5 rounded-[2px] object-cover"
            aria-hidden="true"
          />
          <span className="text-start">{t(current.labelKey)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 opacity-70" />
          ) : (
            <ChevronDown className="h-4 w-4 opacity-70" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        role="listbox"
        align="start"
        sideOffset={6}
        className={
          "min-w-[160px] bg-white/95 text-gray-900 border-gray-200 text-start"
        }
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = option.code === language;
          return (
            <DropdownMenuItem
              key={option.code}
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected ? "true" : "false"}
              disabled={option.disabled}
              onSelect={(event) => {
                if (option.disabled) {
                  event.preventDefault();
                  return;
                }
                if (option.code === "he" || option.code === "en") {
                  updateUserLanguage(option.code);
                }
              }}
              className={"flex items-center gap-2"}
            >
              <img
                src={option.flagSrc}
                alt=""
                className="h-3 w-5 rounded-[2px] object-cover"
                aria-hidden="true"
              />
              <span className="flex-1 text-sm">{t(option.labelKey)}</span>
              {isSelected ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
