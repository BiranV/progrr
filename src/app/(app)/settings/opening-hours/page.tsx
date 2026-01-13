"use client";

import React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { Switch } from "@/components/ui/switch";
import { CenteredSpinner } from "@/components/CenteredSpinner";

import { ONBOARDING_QUERY_KEY, useOnboardingSettings } from "@/hooks/useOnboardingSettings";

type AvailabilityDay = {
    day: number; // 0..6 (Sun..Sat)
    enabled: boolean;
    ranges: TimeRange[];
};

type TimeRange = {
    id: string;
    start: string;
    end: string;
};

type AvailabilityState = {
    timezone: string;
    days: AvailabilityDay[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultDays(): AvailabilityDay[] {
    return DAY_LABELS.map((_, day) => ({
        day,
        enabled: day >= 1 && day <= 5,
        ranges: [{ id: newId(), start: "09:00", end: "17:00" }],
    }));
}

function newId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseTimeToMinutes(hhmm: string): number {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(hhmm ?? ""));
    if (!m) return NaN;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
    if (h < 0 || h > 23) return NaN;
    if (min < 0 || min > 59) return NaN;
    return h * 60 + min;
}

function minutesToTime(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        ...init,
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore
        }

        throw new Error(message);
    }

    return (await res.json()) as T;
}

function normalizeRanges(raw: any): TimeRange[] {
    if (Array.isArray(raw)) {
        const out: TimeRange[] = [];
        for (const r of raw) {
            const start = typeof (r as any)?.start === "string" ? String((r as any).start) : "";
            const end = typeof (r as any)?.end === "string" ? String((r as any).end) : "";
            if (!start && !end) continue;
            out.push({ id: newId(), start, end });
        }
        return out.length ? out : [{ id: newId(), start: "09:00", end: "17:00" }];
    }

    const start = typeof raw?.start === "string" ? String(raw.start) : "";
    const end = typeof raw?.end === "string" ? String(raw.end) : "";
    if (start || end) return [{ id: newId(), start, end }];
    return [{ id: newId(), start: "09:00", end: "17:00" }];
}

function normalizeDays(input: unknown): AvailabilityDay[] {
    const base = defaultDays();
    const byDay = new Map<number, AvailabilityDay>();

    if (Array.isArray(input)) {
        for (const raw of input) {
            const day = Number((raw as any)?.day);
            if (!Number.isInteger(day) || day < 0 || day > 6) continue;
            byDay.set(day, {
                day,
                enabled: Boolean((raw as any)?.enabled),
                ranges: normalizeRanges((raw as any)?.ranges ?? raw),
            });
        }
    }

    return base.map((d) => ({ ...d, ...(byDay.get(d.day) || {}) }));
}

function stableStringifyAvailability(state: AvailabilityState): string {
    const days = [...state.days]
        .slice()
        .sort((a, b) => a.day - b.day)
        .map((d) => ({
            day: d.day,
            enabled: Boolean(d.enabled),
            ranges: (d.ranges || []).map((r) => ({
                start: String(r.start ?? ""),
                end: String(r.end ?? ""),
            })),
        }));

    return JSON.stringify({
        timezone: String(state.timezone || ""),
        days,
    });
}

export default function OpeningHoursPage() {
    const [isSaving, setIsSaving] = React.useState(false);
    const queryClient = useQueryClient();

    const {
        data: onboardingRes,
        isPending,
        dataUpdatedAt,
        refetch,
        isError,
        error,
    } = useOnboardingSettings();

    const initialRef = React.useRef<AvailabilityState | null>(null);
    const [availability, setAvailability] = React.useState<AvailabilityState>({
        timezone: "UTC",
        days: defaultDays(),
    });

    React.useEffect(() => {
        if (isError) {
            toast.error((error as any)?.message || "Failed to load opening hours");
        }
    }, [isError, error]);

    const isDirty = React.useMemo(() => {
        if (!initialRef.current) return false;
        return (
            stableStringifyAvailability(availability) !==
            stableStringifyAvailability(initialRef.current)
        );
    }, [availability]);

    React.useEffect(() => {
        if (!onboardingRes) return;

        const av = (onboardingRes as any)?.onboarding?.availability ?? {};
        const timezone = String((av as any)?.timezone ?? "").trim() || "UTC";
        const days = normalizeDays((av as any)?.days);
        const next: AvailabilityState = { timezone, days };

        // First hydrate, and background refresh only when user isn't editing.
        if (!initialRef.current || (!isDirty && !isSaving)) {
            initialRef.current = next;
            setAvailability(next);
        }
    }, [onboardingRes, isDirty, isSaving]);

    React.useEffect(() => {
        // Background refresh if cached data is older than 2 minutes.
        if (!onboardingRes) return;
        if (Date.now() - dataUpdatedAt < 2 * 60 * 1000) return;
        refetch();
    }, [dataUpdatedAt, onboardingRes, refetch]);

    const showFullPageSpinner = isPending && !onboardingRes && !initialRef.current;

    const validate = React.useCallback((): string | null => {
        for (const d of availability.days) {
            if (!d.enabled) continue;

            const ranges = Array.isArray(d.ranges) ? d.ranges : [];
            if (!ranges.length) {
                return `Please set valid hours for ${DAY_LABELS[d.day]}.`;
            }

            const parsed = ranges
                .map((r) => ({
                    start: String(r.start ?? "").trim(),
                    end: String(r.end ?? "").trim(),
                    startMin: parseTimeToMinutes(String(r.start ?? "").trim()),
                    endMin: parseTimeToMinutes(String(r.end ?? "").trim()),
                }))
                .filter((x) => x.start || x.end);

            for (const r of parsed) {
                if (!r.start || !r.end || !Number.isFinite(r.startMin) || !Number.isFinite(r.endMin)) {
                    return `Please set valid hours for ${DAY_LABELS[d.day]}.`;
                }
                if (r.endMin <= r.startMin) {
                    return `End time must be after start time for ${DAY_LABELS[d.day]}.`;
                }
            }

            const ordered = [...parsed].sort((a, b) => a.startMin - b.startMin);
            for (let i = 1; i < ordered.length; i++) {
                const prev = ordered[i - 1];
                const curr = ordered[i];
                if (overlaps(prev.startMin, prev.endMin, curr.startMin, curr.endMin)) {
                    return `Overlapping time ranges for ${DAY_LABELS[d.day]}.`;
                }
            }
        }

        return null;
    }, [availability.days]);

    const onSave = async () => {
        if (!initialRef.current) return;

        const err = validate();
        if (err) {
            toast.error(err);
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                availability: {
                    timezone: availability.timezone,
                    weekStartsOn: 0,
                    days: availability.days.map((d) => ({
                        day: d.day,
                        enabled: Boolean(d.enabled),
                        ranges: (d.ranges || []).map((r) => ({
                            start: String(r.start ?? "").trim(),
                            end: String(r.end ?? "").trim(),
                        })),
                    })),
                },
            };

            await apiFetch("/api/onboarding", {
                method: "PATCH",
                body: JSON.stringify(payload),
            });

            initialRef.current = availability;
            queryClient.setQueryData(ONBOARDING_QUERY_KEY, (prev: any) => ({
                ...(prev || {}),
                onboarding: {
                    ...((prev as any)?.onboarding || {}),
                    availability: payload.availability,
                },
            }));
            toast.success("Changes saved");
        } catch (e: any) {
            toast.error(e?.message || "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const orderedDays = React.useMemo(() => {
        const byDay = new Map(availability.days.map((d) => [d.day, d] as const));
        return Array.from({ length: 7 }, (_, i) => i)
            .map((day) => byDay.get(day))
            .filter(Boolean) as AvailabilityDay[];
    }, [availability.days]);

    const lastToastAtRef = React.useRef(0);
    const toastOnce = (message: string) => {
        const now = Date.now();
        if (now - lastToastAtRef.current < 900) return;
        lastToastAtRef.current = now;
        toast.error(message);
    };

    const updateRangeTime = (day: number, rangeId: string, field: "start" | "end", value: string) => {
        setAvailability((prev) => {
            const nextDays = prev.days.map((d) => {
                if (d.day !== day) return d;
                const nextRanges = (d.ranges || []).map((r) =>
                    r.id === rangeId ? { ...r, [field]: value } : r
                );

                return {
                    ...d,
                    ranges: nextRanges.length ? nextRanges : [{ id: newId(), start: "09:00", end: "17:00" }],
                };
            });

            return { ...prev, days: nextDays };
        });
    };

    const addRange = (day: number) => {
        setAvailability((prev) => {
            const nextDays = prev.days.map((d) => {
                if (d.day !== day) return d;

                const ranges = Array.isArray(d.ranges) && d.ranges.length ? d.ranges : [{ id: newId(), start: "09:00", end: "17:00" }];

                const complete = ranges
                    .map((r) => ({
                        startMin: parseTimeToMinutes(String(r.start ?? "").trim()),
                        endMin: parseTimeToMinutes(String(r.end ?? "").trim()),
                    }))
                    .filter((x) => Number.isFinite(x.startMin) && Number.isFinite(x.endMin) && x.endMin > x.startMin)
                    .sort((a, b) => a.startMin - b.startMin);

                const lastEnd = complete.length ? complete[complete.length - 1].endMin : 17 * 60;
                const startMin = Math.max(0, Math.min(23 * 60 + 59, lastEnd));
                if (startMin >= 23 * 60 + 59) {
                    toastOnce(`No room to add another range on ${DAY_LABELS[day]}.`);
                    return d;
                }

                const endMin = Math.min(23 * 60 + 59, startMin + 60);
                if (endMin <= startMin) {
                    toastOnce(`No room to add another range on ${DAY_LABELS[day]}.`);
                    return d;
                }

                const candidate = { id: newId(), start: minutesToTime(startMin), end: minutesToTime(endMin) };

                // Prevent overlap against existing complete ranges.
                const collides = complete.some((r) => overlaps(r.startMin, r.endMin, startMin, endMin));
                if (collides) {
                    toastOnce(`Overlapping time ranges for ${DAY_LABELS[day]}.`);
                    return d;
                }

                return { ...d, ranges: [...ranges, candidate] };
            });

            return { ...prev, days: nextDays };
        });
    };

    const deleteRange = (day: number, rangeId: string) => {
        setAvailability((prev) => {
            const nextDays = prev.days.map((d) => {
                if (d.day !== day) return d;
                const ranges = Array.isArray(d.ranges) ? d.ranges : [];
                if (ranges.length <= 1) return d;
                const nextRanges = ranges.filter((r) => r.id !== rangeId);
                return { ...d, ranges: nextRanges.length ? nextRanges : ranges };
            });
            return { ...prev, days: nextDays };
        });
    };

    return showFullPageSpinner ? (
        <CenteredSpinner fullPage />
    ) : (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Opening hours
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Set your working days and hours.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tap a time to open the hour picker.
                </p>
            </div>

            <div className="space-y-5">
                <div className="space-y-3">
                    {orderedDays.map((d) => (
                        <div key={d.day} className="space-y-2">
                            <div className="grid grid-cols-[48px_48px_1fr_40px] items-start gap-x-2 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20">
                                <div className="h-8 flex items-center justify-center">
                                    <Switch
                                        checked={Boolean(d.enabled)}
                                        onCheckedChange={(checked) =>
                                            setAvailability((prev) => ({
                                                ...prev,
                                                days: prev.days.map((x) =>
                                                    x.day === d.day ? { ...x, enabled: checked } : x
                                                ),
                                            }))
                                        }
                                        aria-label={`Toggle ${DAY_LABELS[d.day]}`}
                                        disabled={isSaving || (isPending && !initialRef.current)}
                                    />
                                </div>

                                <div className="h-8 flex items-center text-sm font-medium text-gray-900 dark:text-white select-none">
                                    <span className="w-8">{DAY_LABELS[d.day].substring(0, 3)}</span>
                                </div>

                                <div className="space-y-2 min-w-0">
                                    {(d.ranges || []).map((r, idx) => (
                                        <div key={r.id} className="h-8 flex items-center flex-nowrap gap-2 min-w-0">
                                            <TimePicker
                                                value={String(r.start ?? "")}
                                                onChange={(v) => updateRangeTime(d.day, r.id, "start", v)}
                                                disabled={isSaving || (isPending && !initialRef.current) || !d.enabled}
                                                className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0 cursor-pointer hover:bg-muted/30"
                                                aria-label={`${DAY_LABELS[d.day]} ${idx === 0 ? "start" : "additional start"} time`}
                                            />
                                            <span className="text-gray-400 shrink-0">–</span>
                                            <TimePicker
                                                value={String(r.end ?? "")}
                                                onChange={(v) => updateRangeTime(d.day, r.id, "end", v)}
                                                disabled={isSaving || (isPending && !initialRef.current) || !d.enabled}
                                                className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0 cursor-pointer hover:bg-muted/30"
                                                aria-label={`${DAY_LABELS[d.day]} ${idx === 0 ? "end" : "additional end"} time`}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 flex flex-col items-end">
                                    {(d.ranges || []).map((r, idx) => (
                                        <div key={r.id} className="h-8 flex items-center justify-end">
                                            {idx === 0 ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => addRange(d.day)}
                                                    disabled={isSaving || (isPending && !initialRef.current) || !d.enabled}
                                                    aria-label={`Add time range for ${DAY_LABELS[d.day]}`}
                                                >
                                                    <Plus className="h-4 w-4 ms-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => deleteRange(d.day, r.id)}
                                                    disabled={isSaving || (isPending && !initialRef.current) || !d.enabled || (d.ranges?.length ?? 0) <= 1}
                                                    aria-label={`Delete time range for ${DAY_LABELS[d.day]}`}
                                                >
                                                    <Trash2 className="h-4 w-4 ms-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-2">
                    <Button
                        type="button"
                        className="w-full"
                        onClick={onSave}
                        disabled={!isDirty || isSaving || (isPending && !initialRef.current) || !initialRef.current}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
