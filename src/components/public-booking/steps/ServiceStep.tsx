"use client";

import * as React from "react";

type Service = {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
};

export default function ServiceStep({
    services,
    currency,
    locale,
    onSelect,
    formatPrice,
    t,
}: {
    services: Service[];
    currency: { code: string; name?: string; symbol?: string };
    locale: string;
    onSelect: (serviceId: string) => void;
    formatPrice: (args: {
        price: number;
        currency: { code: string; name?: string; symbol?: string };
        locale?: string;
    }) => string;
    t: (key: string, params?: Record<string, any>) => string;
}) {
    return (
        <div className="space-y-3">
            {services.map((s) => (
                <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={
                        "w-full text-start rounded-2xl border border-gray-200 dark:border-gray-800 " +
                        "bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm " +
                        "transition cursor-pointer " +
                        "hover:bg-white hover:shadow-md hover:-translate-y-[1px] " +
                        "dark:hover:bg-gray-900/30 " +
                        "active:translate-y-0 active:shadow-sm"
                    }
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">
                                {s.name}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                {t("publicBooking.minutes", { count: s.durationMinutes })}
                            </div>
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white shrink-0">
                            {formatPrice({ price: s.price, currency, locale })}
                        </div>
                    </div>
                </button>
            ))}

            {!services.length && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    {t("publicBooking.errors.noServices")}
                </div>
            )}
        </div>
    );
}
