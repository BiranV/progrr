import type { AppointmentDoc, UserDoc } from "@/server/collections";

type OnboardingAvailability = NonNullable<UserDoc["onboarding"]>["availability"];

export function parseTimeToMinutes(hhmm: string): number {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(hhmm ?? ""));
    if (!m) return NaN;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
    if (h < 0 || h > 23) return NaN;
    if (min < 0 || min > 59) return NaN;
    return h * 60 + min;
}

export function minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

export function weekdayForDateInTimeZone(args: {
    date: string; // YYYY-MM-DD
    timeZone: string;
}): number {
    const tz = args.timeZone || "UTC";
    // Use noon UTC to reduce off-by-one issues.
    const d = new Date(`${args.date}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return NaN;

    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
    })
        .format(d)
        .toLowerCase();

    const map: Record<string, number> = {
        sun: 0,
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6,
    };

    return typeof map[weekday] === "number" ? map[weekday] : NaN;
}

export function getBusinessDaySchedule(args: {
    onboardingAvailability: OnboardingAvailability | undefined;
    date: string;
}): { enabled: boolean; ranges: Array<{ start: string; end: string }>; timeZone: string } {
    const availability = args.onboardingAvailability ?? {};
    const timeZone = String((availability as any)?.timezone ?? "").trim() || "UTC";

    const weekday = weekdayForDateInTimeZone({ date: args.date, timeZone });
    const days = Array.isArray((availability as any)?.days)
        ? ((availability as any).days as any[])
        : [];

    const day = days.find((d) => Number(d?.day) === weekday);
    const enabled = Boolean(day?.enabled);

    const rangesRaw = Array.isArray((day as any)?.ranges) ? ((day as any).ranges as any[]) : null;
    const ranges = rangesRaw
        ? rangesRaw
            .map((r) => ({
                start: String(r?.start ?? "").trim(),
                end: String(r?.end ?? "").trim(),
            }))
            .filter((r) => r.start || r.end)
        : [];

    // Legacy fallback: {start,end} on the day.
    const legacyStart = String((day as any)?.start ?? "").trim();
    const legacyEnd = String((day as any)?.end ?? "").trim();
    const normalizedRanges = ranges.length
        ? ranges
        : legacyStart || legacyEnd
            ? [{ start: legacyStart, end: legacyEnd }]
            : [];

    return {
        enabled,
        ranges: normalizedRanges,
        timeZone,
    };
}

export function computeAvailableSlots(args: {
    date: string; // YYYY-MM-DD
    durationMinutes: number;
    onboardingAvailability: OnboardingAvailability | undefined;
    bookedAppointments: AppointmentDoc[];
}): Array<{ startTime: string; endTime: string }> {
    const schedule = getBusinessDaySchedule({
        onboardingAvailability: args.onboardingAvailability,
        date: args.date,
    });

    if (!schedule.enabled) return [];
    const duration = Number(args.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return [];

    const busy = (args.bookedAppointments || [])
        .filter((a) => a.status === "BOOKED")
        .map((a) => ({
            start: parseTimeToMinutes(a.startTime),
            end: parseTimeToMinutes(a.endTime),
        }))
        .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end));

    const out: Array<{ startTime: string; endTime: string }> = [];

    for (const r of schedule.ranges) {
        const startMin = parseTimeToMinutes(r.start);
        const endMin = parseTimeToMinutes(r.end);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
        if (endMin <= startMin) continue;

        for (let t = startMin; t + duration <= endMin; t += duration) {
            const slotStart = t;
            const slotEnd = t + duration;

            const collides = busy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
            if (collides) continue;

            out.push({
                startTime: minutesToTime(slotStart),
                endTime: minutesToTime(slotEnd),
            });
        }
    }

    return out;
}
