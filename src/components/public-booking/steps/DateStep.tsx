"use client";

import * as React from "react";
import Flatpickr from "react-flatpickr";

export default function DateStep({
    flatpickrKey,
    options,
    value,
    onSelectDate,
    selectDateAria,
}: {
    flatpickrKey: string;
    options: any;
    value?: string;
    onSelectDate: (dateStr: string) => void;
    selectDateAria: string;
}) {
    return (
        <div className="space-y-4">
            <div className="flex justify-center">
                <div className="w-full">
                    <Flatpickr
                        key={flatpickrKey}
                        options={options}
                        value={value}
                        onChange={(_selectedDates: Date[], dateStr: string) => {
                            const next = String(dateStr || "").trim();
                            if (!next) return;
                            onSelectDate(next);
                        }}
                        render={(_props: any, ref: any) => (
                            <input
                                ref={ref as any}
                                type="text"
                                aria-label={selectDateAria}
                                className="sr-only"
                            />
                        )}
                    />
                </div>
            </div>
        </div>
    );
}
