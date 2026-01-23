"use client";

import * as React from "react";

import { CenteredSpinner } from "@/components/CenteredSpinner";

type Slot = { startTime: string; endTime: string };

type SlotsResponse = {
    slots: Slot[];
};

export default function TimeStep({
    loading,
    error,
    slots,
    selectedTime,
    onSelectTime,
    onConfirm,
    t,
}: {
    loading: boolean;
    error?: string | null;
    slots?: SlotsResponse | null;
    selectedTime: string;
    onSelectTime: (startTime: string) => void;
    onConfirm: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {loading ? (
                    <CenteredSpinner className="min-h-[40vh] items-center" />
                ) : error ? (
                    <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                ) : slots ? (
                    <>
                        {slots.slots.length ? (
                            <div className="grid grid-cols-3 gap-2">
                                {slots.slots.map((s) => (
                                    <button
                                        key={s.startTime}
                                        className={
                                            "w-full h-16 rounded-2xl border border-gray-200 dark:border-gray-800 " +
                                            "bg-white/70 dark:bg-gray-950/20 shadow-sm " +
                                            "transition cursor-pointer " +
                                            "hover:bg-white hover:shadow-md hover:-translate-y-[1px] " +
                                            "dark:hover:bg-gray-900/30 " +
                                            "active:translate-y-0 active:shadow-sm " +
                                            "flex flex-col items-center justify-center text-center"
                                        }
                                        onClick={() => onSelectTime(s.startTime)}
                                    >
                                        <div className="font-semibold text-gray-900 dark:text-white leading-none">
                                            {s.startTime}
                                        </div>
                                        <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-none mt-1">
                                            {s.endTime}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {!slots.slots.length ? (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                {t("publicBooking.errors.noTimes")}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        {t("publicBooking.errors.selectDateToSeeTimes")}
                    </div>
                )}
            </div>
            <button
                onClick={onConfirm}
                className={
                    "w-full rounded-full py-3 text-white font-semibold shadow-lg shadow-blue-600/30 transition " +
                    "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                }
                disabled={!selectedTime}
            >
                {t("publicBooking.steps.details")}
            </button>
        </div>
    );
}
