"use client";

import React from "react";
import { Phone } from "lucide-react";

import { useI18n } from "@/i18n/useI18n";
import { useLocale } from "@/context/LocaleContext";
import { formatPhoneNumber } from "@/lib/phone-format";
import { cn } from "@/lib/utils";

type PhoneLinkProps = {
    phone?: string | null;
    className?: string;
    iconClassName?: string;
    showIcon?: boolean;
    title?: string;
    stopPropagation?: boolean;
};

export function PhoneLink({
    phone,
    className,
    iconClassName,
    showIcon = true,
    title,
    stopPropagation = false,
}: PhoneLinkProps) {
    const { t } = useI18n();
    const { locale } = useLocale();

    const raw = String(phone ?? "").trim();
    if (!raw) return null;

    const display = formatPhoneNumber(raw, locale) || raw;
    const href = `tel:${raw}`;

    return (
        <a
            href={href}
            title={title ?? t("common.callCustomer")}
            aria-label={title ?? t("common.callCustomer")}
            className={cn(
                "inline-flex items-center gap-1 rtl:flex-row-reverse text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors",
                className,
            )}
            onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
            }}
        >
            {showIcon ? (
                <Phone
                    className={cn("h-3.5 w-3.5 text-gray-500", iconClassName)}
                />
            ) : null}
            <span dir="ltr" className="truncate">
                {display}
            </span>
        </a>
    );
}
