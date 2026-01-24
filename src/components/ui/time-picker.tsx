"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";

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

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export type TimePickerProps = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    "aria-label"?: string;
};

export function TimePicker({
    value,
    onChange,
    disabled,
    className,
    placeholder = "--:--",
    ...a11y
}: TimePickerProps) {
    const { t } = useI18n();
    const [open, setOpen] = React.useState(false);
    const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";

    const parsed = parseTime(value);
    const initialHour = parsed?.h ?? 9;
    const initialMinute = parsed?.m ?? 0;

    const [hour, setHour] = React.useState<number>(initialHour);
    const [minute, setMinute] = React.useState<number>(initialMinute);
    const [draft, setDraft] = React.useState<string>(parsed ? formatTime(parsed.h, parsed.m) : "");

    const hourListRef = React.useRef<HTMLDivElement | null>(null);
    const minuteListRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!open) return;
        const nextParsed = parseTime(value);
        const nextHour = nextParsed?.h ?? 9;
        const nextMinute = nextParsed?.m ?? 0;
        setHour(nextHour);
        setMinute(nextMinute);
        setDraft(nextParsed ? formatTime(nextParsed.h, nextParsed.m) : "");

        requestAnimationFrame(() => {
            const hourEl = hourListRef.current?.querySelector<HTMLElement>(
                `[data-hour='${nextHour}']`
            );
            const minuteEl = minuteListRef.current?.querySelector<HTMLElement>(
                `[data-minute='${nextMinute}']`
            );
            hourEl?.scrollIntoView({ block: "center" });
            minuteEl?.scrollIntoView({ block: "center" });
        });
    }, [open, value]);

    const commit = React.useCallback(() => {
        const fromDraft = parseTime(draft);
        const next = fromDraft ? formatTime(fromDraft.h, fromDraft.m) : formatTime(hour, minute);
        onChange(next);
        setOpen(false);
    }, [draft, hour, minute, onChange]);

    const display = parsed ? formatTime(parsed.h, parsed.m) : "";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setOpen(true);
                }}
                className={cn(
                    "border-input dark:bg-input/30 bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "inline-flex items-center justify-center rounded-md border shadow-xs outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "tabular-nums",
                    className
                )}
                {...a11y}
            >
                <span dir="ltr" className={cn(!display && "text-muted-foreground")}>
                    {display || placeholder}
                </span>
            </button>

            <DialogContent
                className={cn(
                    "p-3 gap-2",
                    // Always centered (mobile + desktop), with RTL-safe positioning
                    isRtl
                        ? "top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 rounded-lg"
                        : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg",
                    "w-[calc(100%-2rem)] max-w-sm"
                )}
            >
                <DialogHeader className="gap-1">
                    <DialogTitle className="text-sm">{t("timePicker.title")}</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                    <Input
                        inputMode="numeric"
                        placeholder="HH:mm"
                        value={draft}
                        onChange={(e) => {
                            const v = e.target.value;
                            setDraft(v);
                            const p = parseTime(v);
                            if (p) {
                                setHour(p.h);
                                setMinute(p.m);
                            }
                        }}
                        aria-label="Time value"
                        dir="ltr"
                        className="h-9 text-sm"
                    />

                    <div className="grid grid-cols-2 gap-3" dir="ltr">
                        <div className="min-w-0">
                            <div className={cn("text-xs text-muted-foreground mb-1", isRtl && "text-right")}>
                                {t("timePicker.hours")}
                            </div>
                            <div
                                ref={hourListRef}
                                className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-1 snap-y snap-mandatory"
                            >
                                {HOURS.map((h) => {
                                    const selected = h === hour;
                                    return (
                                        <button
                                            key={h}
                                            type="button"
                                            data-hour={h}
                                            aria-selected={selected}
                                            onClick={() => {
                                                setHour(h);
                                                const next = formatTime(h, minute);
                                                setDraft(next);
                                            }}
                                            className={cn(
                                                "w-full snap-center rounded-md px-2 py-1.5 text-[13px] text-center tabular-nums",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                                selected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "hover:bg-primary/10"
                                            )}
                                        >
                                            {String(h).padStart(2, "0")}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-w-0">
                            <div className={cn("text-xs text-muted-foreground mb-1", isRtl && "text-right")}>
                                {t("timePicker.minutes")}
                            </div>
                            <div
                                ref={minuteListRef}
                                className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-1 snap-y snap-mandatory"
                            >
                                {MINUTES.map((m) => {
                                    const selected = m === minute;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            data-minute={m}
                                            aria-selected={selected}
                                            onClick={() => {
                                                setMinute(m);
                                                const next = formatTime(hour, m);
                                                setDraft(next);
                                            }}
                                            className={cn(
                                                "w-full snap-center rounded-md px-2 py-1.5 text-[13px] text-center tabular-nums",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                                selected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "hover:bg-primary/10"
                                            )}
                                        >
                                            {String(m).padStart(2, "0")}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="ghost" size="sm">
                            {t("common.cancel")}
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={commit} size="sm">
                        {t("common.done")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
