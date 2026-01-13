"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseTime(value: string): { h: number; m: number } | null {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(value ?? ""));
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
    if (h < 0 || h > 23) return null;
    if (min < 0 || min > 59) return null;
    return { h, m: min };
}

function formatTime(h: number, m: number): string {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm}`;
}

function buildTimes(stepMinutes: number): string[] {
    const step = Math.max(1, Math.min(60, Math.floor(stepMinutes)));
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += step) {
            out.push(formatTime(h, m));
        }
    }
    return out;
}

export type TimePickerProps = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    minuteStep?: number;
    className?: string;
    "aria-label"?: string;
};

export function TimePicker({
    value,
    onChange,
    disabled,
    placeholder = "--:--",
    minuteStep = 15,
    className,
    ...a11y
}: TimePickerProps) {
    const [open, setOpen] = React.useState(false);

    const times = React.useMemo(() => buildTimes(minuteStep), [minuteStep]);
    const parsed = parseTime(value);
    const display = parsed ? formatTime(parsed.h, parsed.m) : placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "border-input dark:bg-input/30 bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                        "inline-flex items-center justify-center rounded-md border shadow-xs outline-none",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    {...a11y}
                >
                    <span className={cn("tabular-nums", !parsed && "text-muted-foreground")}>{display}</span>
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-[170px] p-2"
            >
                <div className="max-h-56 overflow-y-auto">
                    <div className="grid gap-1">
                        {times.map((t) => {
                            const isSelected = t === display;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        onChange(t);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "w-full rounded-md px-2 py-1 text-left text-sm tabular-nums",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                        isSelected
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-primary/10"
                                    )}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
