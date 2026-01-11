"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type WorkoutStatus = "PLANNED" | "COMPLETED" | "SKIPPED";
type NutritionStatus = "FOLLOWED" | "PARTIALLY_FOLLOWED" | "NOT_FOLLOWED";

type DayTimeState = "past" | "today" | "future";
type WorkoutReportStatus = Exclude<WorkoutStatus, "PLANNED">;

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function toLocalDateKey(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getDayTimeState(dateKey: string, todayKey: string): DayTimeState {
    if (dateKey < todayKey) return "past";
    if (dateKey > todayKey) return "future";
    return "today";
}

function workoutBadge(status?: string | null) {
    const s = String(status ?? "").toUpperCase();
    if (s === "COMPLETED") return { label: "Workout: Completed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" };
    if (s === "SKIPPED") return { label: "Workout: Skipped", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" };
    return { label: "Workout: —", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200" };
}

function nutritionBadge(status?: string | null) {
    const s = String(status ?? "").toUpperCase();
    if (s === "FOLLOWED") return { label: "Nutrition: Followed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" };
    if (s === "PARTIALLY_FOLLOWED") return { label: "Nutrition: Partial", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/25 dark:text-yellow-200" };
    if (s === "NOT_FOLLOWED") return { label: "Nutrition: Not followed", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" };
    return { label: "Nutrition: —", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200" };
}

function dotClassForWorkout(status?: string | null) {
    const s = String(status ?? "").toUpperCase();
    if (s === "COMPLETED") return "bg-emerald-500";
    if (s === "SKIPPED") return "bg-red-500";
    return "bg-gray-300 dark:bg-gray-600";
}

function dotClassForNutrition(status?: string | null) {
    const s = String(status ?? "").toUpperCase();
    if (s === "FOLLOWED") return "bg-emerald-500";
    if (s === "PARTIALLY_FOLLOWED") return "bg-yellow-500";
    if (s === "NOT_FOLLOWED") return "bg-red-500";
    return "bg-gray-300 dark:bg-gray-600";
}

export function DailyComplianceCalendar(props: {
    assignedWorkoutPlans?: Array<{ id: string; name: string }>;
    assignedMealPlans?: Array<{ id: string; name: string }>;
    clientId?: string;
    readOnly?: boolean;
}) {
    const queryClient = useQueryClient();

    const clientId = String(props.clientId ?? "").trim();
    const isReadOnly = props.readOnly === true || Boolean(clientId);

    const todayKey = React.useMemo(() => toLocalDateKey(new Date()), []);

    const weekStartStorageKey = isReadOnly
        ? "dailyCompliance.weekStart.admin"
        : "dailyCompliance.weekStart.client";

    const [weekStartsOn, setWeekStartsOn] = React.useState<0 | 1>(() => {
        if (typeof window === "undefined") return 1;
        const raw = window.localStorage.getItem(weekStartStorageKey);
        return raw === "0" ? 0 : 1;
    });

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(weekStartStorageKey, String(weekStartsOn));
    }, [weekStartsOn, weekStartStorageKey]);

    const [mode, setMode] = React.useState<"week" | "month">("week");
    const [anchorDate, setAnchorDate] = React.useState<Date>(() => new Date());
    const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

    const range = React.useMemo(() => {
        if (mode === "week") {
            const start = startOfWeek(anchorDate, { weekStartsOn });
            start.setHours(0, 0, 0, 0);
            const end = addDays(start, 6);
            return { start, end };
        }
        const start = startOfMonth(anchorDate);
        const end = endOfMonth(anchorDate);
        return { start, end };
    }, [mode, anchorDate, weekStartsOn]);

    const startKey = React.useMemo(() => toLocalDateKey(range.start), [range.start]);
    const endKey = React.useMemo(() => toLocalDateKey(range.end), [range.end]);

    const { data: rangeData, isLoading } = useQuery({
        queryKey: clientId
            ? ["dailyLogsRange", "admin", clientId, startKey, endKey]
            : ["dailyLogsRange", "client", startKey, endKey],
        queryFn: async () => {
            const qp = new URLSearchParams({ start: startKey, end: endKey });
            if (clientId) qp.set("clientId", clientId);
            const res = await fetch(
                `/api/daily-logs/range?${qp.toString()}`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || `Request failed (${res.status})`);
            }
            return payload as {
                ok: true;
                start: string;
                end: string;
                days: Array<{
                    date: string;
                    workout?: any;
                    nutrition?: any;
                    flagged?: boolean;
                }>;
            };
        },
    });

    const byDate = React.useMemo(() => {
        const map = new Map<string, any>();
        for (const d of rangeData?.days ?? []) {
            map.set(String(d.date), d);
        }
        return map;
    }, [rangeData]);

    const selectedKey = selectedDate ? toLocalDateKey(selectedDate) : null;
    const selectedEntry = selectedKey ? byDate.get(selectedKey) : null;

    const selectedDayState: DayTimeState | null = selectedKey
        ? getDayTimeState(selectedKey, todayKey)
        : null;
    const canReport = !isReadOnly && (selectedDayState === "past" || selectedDayState === "today");

    const [workoutStatus, setWorkoutStatus] = React.useState<WorkoutReportStatus | null>(null);
    const [nutritionStatus, setNutritionStatus] = React.useState<NutritionStatus | null>(null);
    const [workoutNote, setWorkoutNote] = React.useState<string>("");
    const [nutritionNote, setNutritionNote] = React.useState<string>("");

    React.useEffect(() => {
        if (!selectedKey) return;
        const w = selectedEntry?.workout;
        const n = selectedEntry?.nutrition;
        const dayState = getDayTimeState(selectedKey, todayKey);

        if (dayState === "future") {
            setWorkoutStatus(null);
            setNutritionStatus(null);
            setWorkoutNote("");
            setNutritionNote("");
            return;
        }

        const ws = String(w?.status ?? "").trim().toUpperCase();
        setWorkoutStatus(ws === "COMPLETED" || ws === "SKIPPED" ? (ws as WorkoutReportStatus) : null);

        const ns = String(n?.complianceStatus ?? "").trim().toUpperCase();
        setNutritionStatus(
            ns === "FOLLOWED" || ns === "PARTIALLY_FOLLOWED" || ns === "NOT_FOLLOWED"
                ? (ns as NutritionStatus)
                : null
        );

        setWorkoutNote(String(w?.clientNote ?? ""));
        setNutritionNote(String(n?.clientNote ?? ""));
    }, [selectedKey, selectedEntry]);

    const upsertWorkout = useMutation({
        mutationFn: async (next: { date: string; status: WorkoutReportStatus; clientNote?: string }) => {
            if (isReadOnly) return null;
            const res = await fetch("/api/daily-logs/workout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(next),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
            return payload;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["dailyLogsRange"] });
        },
        onError: (err: any) => toast.error(err?.message || "Failed to update workout log"),
    });

    const upsertNutrition = useMutation({
        mutationFn: async (next: { date: string; complianceStatus: NutritionStatus; clientNote?: string }) => {
            if (isReadOnly) return null;
            const res = await fetch("/api/daily-logs/nutrition", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(next),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
            return payload;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["dailyLogsRange"] });
        },
        onError: (err: any) => toast.error(err?.message || "Failed to update nutrition log"),
    });

    const goPrev = () => {
        const d = new Date(anchorDate);
        if (mode === "week") d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1);
        setAnchorDate(d);
    };

    const goNext = () => {
        const d = new Date(anchorDate);
        if (mode === "week") d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        setAnchorDate(d);
    };

    const goToday = () => setAnchorDate(new Date());

    const assignedWorkoutNames = (props.assignedWorkoutPlans ?? [])
        .map((p) => String(p?.name ?? "").trim())
        .filter(Boolean);
    const assignedMealNames = (props.assignedMealPlans ?? [])
        .map((p) => String(p?.name ?? "").trim())
        .filter(Boolean);

    const headerLabel =
        mode === "week"
            ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d")}`
            : format(range.start, "MMMM yyyy");

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" className="flex-1 justify-center gap-2" onClick={goToday}>
                        <CalendarIcon className="w-4 h-4" />
                        {headerLabel}
                    </Button>
                    <Button variant="outline" size="icon" onClick={goNext} aria-label="Next">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="sr-only">Week starts</span>
                        <span className="hidden sm:inline text-xs text-muted-foreground">Week starts</span>
                        <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setWeekStartsOn(0)}
                                className={`h-7 text-xs rounded-l-md rounded-r-none px-2 ${weekStartsOn === 0
                                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                                    : ""
                                    }`}
                            >
                                Sun
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setWeekStartsOn(1)}
                                className={`h-7 text-xs rounded-r-md rounded-l-none px-2 border-l border-gray-200 dark:border-gray-700 ${weekStartsOn === 1
                                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                                    : ""
                                    }`}
                            >
                                Mon
                            </Button>
                        </div>
                    </div>

                    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode("week")}
                            className={`h-7 text-xs rounded-l-md rounded-r-none px-2 ${mode === "week"
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                                : ""
                                }`}
                        >
                            Week
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMode("month")}
                            className={`h-7 text-xs rounded-r-md rounded-l-none px-2 border-l border-gray-200 dark:border-gray-700 ${mode === "month"
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                                : ""
                                }`}
                        >
                            Month
                        </Button>
                    </div>
                </div>
            </div>

            {mode === "week" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 7 }).map((_, i) => {
                        const d = addDays(range.start, i);
                        const key = toLocalDateKey(d);
                        const entry = byDate.get(key);
                        const isToday = key === todayKey;
                        const dayState = getDayTimeState(key, todayKey);

                        const workoutStatusForCell =
                            dayState === "future" ? null : entry?.workout?.status;
                        const nutritionStatusForCell =
                            dayState === "future" ? null : entry?.nutrition?.complianceStatus;

                        const showWorkoutChip =
                            dayState === "future" || Boolean(workoutStatusForCell);
                        const showNutritionChip =
                            dayState === "future" || Boolean(nutritionStatusForCell);

                        const w = showWorkoutChip
                            ? dayState === "future"
                                ? {
                                    label: "Workout: Planned",
                                    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200",
                                }
                                : workoutBadge(workoutStatusForCell)
                            : null;

                        const n = showNutritionChip
                            ? dayState === "future"
                                ? {
                                    label: "Nutrition: Planned",
                                    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200",
                                }
                                : nutritionBadge(nutritionStatusForCell)
                            : null;

                        return (
                            <button
                                key={key}
                                type="button"
                                className={
                                    "cursor-pointer text-left rounded-xl border p-3 bg-white dark:bg-gray-900/30 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors overflow-hidden " +
                                    (isToday ? "border-indigo-200 dark:border-indigo-800" : "border-gray-200")
                                }
                                onClick={() => setSelectedDate(d)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-900 dark:text-white">
                                            {format(d, "EEE")}
                                            {isToday ? (
                                                <span className="ml-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                                                    Today
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {format(d, "PPP")}
                                        </div>
                                    </div>
                                    {entry?.flagged ? (
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Flag</span>
                                    ) : null}
                                </div>

                                {w || n ? (
                                    <div className="mt-3 space-y-2 min-w-0">
                                        {w ? (
                                            <Badge
                                                title={w.label}
                                                className={`${w.cls} w-full max-w-full justify-start whitespace-normal break-words text-left leading-tight`}
                                            >
                                                <Dumbbell className="h-3 w-3" />
                                                {w.label.replace(/^Workout:\s*/i, "")}
                                            </Badge>
                                        ) : null}
                                        {n ? (
                                            <Badge
                                                title={n.label}
                                                className={`${n.cls} w-full max-w-full justify-start whitespace-normal break-words text-left leading-tight`}
                                            >
                                                <Utensils className="h-3 w-3" />
                                                {n.label.replace(/^Nutrition:\s*/i, "")}
                                            </Badge>
                                        ) : null}
                                    </div>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-lg border bg-white dark:bg-gray-900/30 dark:border-gray-700">
                    <Calendar
                        mode="single"
                        selected={selectedDate ?? undefined}
                        onSelect={(d) => {
                            if (d) setSelectedDate(d);
                        }}
                        month={anchorDate}
                        onMonthChange={(m) => setAnchorDate(m)}
                        className="p-2"
                        // Month mode: use DayPicker v9 keys + hide weekday headers.
                        classNames={{
                            // Layout
                            months: "flex flex-col",
                            month: "space-y-2",
                            month_grid: "w-full",
                            weeks: "flex flex-col gap-1",
                            week: "flex w-full justify-between",
                            day: "relative p-0 text-center text-sm",
                            day_button:
                                "h-9 w-9 cursor-pointer rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",

                            // Hide internal header/navigation + weekday labels
                            month_caption: "hidden",
                            nav: "hidden",
                            weekdays: "hidden",
                            weekday: "hidden",

                            // States
                            selected:
                                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                            today: "bg-accent text-accent-foreground",
                            outside: "text-muted-foreground opacity-50",
                            disabled: "text-muted-foreground opacity-50",
                        }}
                        components={{
                            DayButton: ({ day, ...buttonProps }) => {
                                const date = day.date;
                                const key = toLocalDateKey(date);
                                const dayState = getDayTimeState(key, todayKey);
                                const entry = byDate.get(key);

                                const workoutDot =
                                    dayState === "future"
                                        ? "bg-gray-300 dark:bg-gray-600"
                                        : dotClassForWorkout(entry?.workout?.status);
                                const nutritionDot =
                                    dayState === "future"
                                        ? "bg-gray-300 dark:bg-gray-600"
                                        : dotClassForNutrition(
                                            entry?.nutrition?.complianceStatus
                                        );

                                return (
                                    <button {...buttonProps}>
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="text-sm">{date.getDate()}</div>
                                            <div className="mt-1 flex items-center gap-1">
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${workoutDot}`}
                                                    title={
                                                        dayState === "future"
                                                            ? "Planned"
                                                            : String(entry?.workout?.status ?? "")
                                                    }
                                                />
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${nutritionDot}`}
                                                    title={
                                                        dayState === "future"
                                                            ? "Planned"
                                                            : String(
                                                                entry?.nutrition
                                                                    ?.complianceStatus ?? ""
                                                            )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </button>
                                );
                            }
                        }}
                    />
                </div>
            )
            }

            <div className="text-xs text-gray-500 dark:text-gray-400">
                {isLoading
                    ? "Loading logs…"
                    : isReadOnly
                        ? "Click a day to review workout + nutrition."
                        : "Click a day to report workout + nutrition."}
            </div>

            <Dialog open={Boolean(selectedDate)} onOpenChange={(o) => (!o ? setSelectedDate(null) : null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Daily Tracking</DialogTitle>
                        <DialogDescription>
                            {selectedDate ? format(selectedDate, "PPPP") : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="rounded-lg border p-4 bg-white dark:bg-gray-900/30 dark:border-gray-700">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Workout</div>
                                <Badge className={workoutBadge(workoutStatus ?? undefined).cls}>
                                    {workoutStatus ? workoutStatus.replace(/_/g, " ") : "—"}
                                </Badge>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Assigned plan: {assignedWorkoutNames.length ? assignedWorkoutNames.join(", ") : "None"}
                            </div>

                            {selectedDayState === "future" && !isReadOnly ? (
                                <div className="mt-3 text-xs text-gray-500">
                                    Reporting is available after the day is completed.
                                </div>
                            ) : null}

                            {canReport ? (
                                <>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(["COMPLETED", "SKIPPED"] as const).map((s) => (
                                            <Button
                                                key={s}
                                                type="button"
                                                size="sm"
                                                variant={workoutStatus === s ? "default" : "outline"}
                                                disabled={!selectedKey || upsertWorkout.isPending}
                                                onClick={() => setWorkoutStatus(s)}
                                            >
                                                {s.replace("_", " ")}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="mt-3">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Note (optional)</label>
                                        <Textarea
                                            value={workoutNote}
                                            onChange={(e) => setWorkoutNote(e.target.value)}
                                            placeholder="How did it go? Anything to tell your coach?"
                                            className="mt-1"
                                        />
                                    </div>
                                </>
                            ) : isReadOnly ? (
                                <div className="mt-3">
                                    <div className="text-xs text-gray-500">
                                        {workoutStatus ? "Client-reported changes" : "No report submitted."}
                                    </div>
                                    {workoutNote?.trim() ? (
                                        <Textarea
                                            value={workoutNote}
                                            readOnly
                                            className="mt-2"
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-lg border p-4 bg-white dark:bg-gray-900/30 dark:border-gray-700">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Nutrition</div>
                                <Badge className={nutritionBadge(nutritionStatus ?? undefined).cls}>
                                    {nutritionStatus ? nutritionStatus.replace(/_/g, " ") : "—"}
                                </Badge>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Assigned plan: {assignedMealNames.length ? assignedMealNames.join(", ") : "None"}
                            </div>

                            {selectedDayState === "future" && !isReadOnly ? (
                                <div className="mt-3 text-xs text-gray-500">
                                    Reporting is available after the day is completed.
                                </div>
                            ) : null}

                            {canReport ? (
                                <>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(["FOLLOWED", "PARTIALLY_FOLLOWED", "NOT_FOLLOWED"] as const).map((s) => (
                                            <Button
                                                key={s}
                                                type="button"
                                                size="sm"
                                                variant={nutritionStatus === s ? "default" : "outline"}
                                                disabled={!selectedKey || upsertNutrition.isPending}
                                                onClick={() => setNutritionStatus(s)}
                                            >
                                                {s.replace(/_/g, " ")}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="mt-3">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Note (optional)</label>
                                        <Textarea
                                            value={nutritionNote}
                                            onChange={(e) => setNutritionNote(e.target.value)}
                                            placeholder="Any challenges, cravings, or wins today?"
                                            className="mt-1"
                                        />
                                    </div>
                                </>
                            ) : isReadOnly ? (
                                <div className="mt-3">
                                    <div className="text-xs text-gray-500">
                                        {nutritionStatus ? "Client-reported changes" : "No report submitted."}
                                    </div>
                                    {nutritionNote?.trim() ? (
                                        <Textarea
                                            value={nutritionNote}
                                            readOnly
                                            className="mt-2"
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedDate(null)}
                        >
                            Close
                        </Button>
                        {canReport ? (
                            <Button
                                type="button"
                                disabled={!selectedKey || upsertWorkout.isPending || upsertNutrition.isPending}
                                onClick={async () => {
                                    if (!selectedKey) return;
                                    try {
                                        const ops: Array<Promise<any>> = [];
                                        if (workoutStatus) {
                                            ops.push(
                                                upsertWorkout.mutateAsync({
                                                    date: selectedKey,
                                                    status: workoutStatus,
                                                    clientNote: workoutNote?.trim()
                                                        ? workoutNote.trim()
                                                        : undefined,
                                                })
                                            );
                                        }
                                        if (nutritionStatus) {
                                            ops.push(
                                                upsertNutrition.mutateAsync({
                                                    date: selectedKey,
                                                    complianceStatus: nutritionStatus,
                                                    clientNote: nutritionNote?.trim()
                                                        ? nutritionNote.trim()
                                                        : undefined,
                                                })
                                            );
                                        }

                                        if (!ops.length) {
                                            toast.error("No report submitted.");
                                            return;
                                        }

                                        await Promise.all(ops);
                                        toast.success("Saved");
                                        setSelectedDate(null);
                                    } catch {
                                        // errors already toasted
                                    }
                                }}
                            >
                                {upsertWorkout.isPending || upsertNutrition.isPending
                                    ? "Saving..."
                                    : "Save"}
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
