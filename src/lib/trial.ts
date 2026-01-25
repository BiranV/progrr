export type TrialInfoInput = {
    trialStartAt?: string | null;
    trialEndAt?: string | null;
    timeZone?: string | null;
    now?: Date;
};

export type TrialInfo = {
    daysLeft: number;
    isActive: boolean;
};

function getZonedDateParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value || 0);

    return {
        year: get("year"),
        month: get("month"),
        day: get("day"),
        hour: get("hour"),
        minute: get("minute"),
        second: get("second"),
    };
}

function toZonedTimeMs(date: Date, timeZone: string) {
    const parts = getZonedDateParts(date, timeZone);
    return Date.UTC(
        parts.year,
        Math.max(0, parts.month - 1),
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
    );
}

export function getTrialInfo({
    trialStartAt,
    trialEndAt,
    timeZone,
    now = new Date(),
}: TrialInfoInput): TrialInfo {
    if (!trialStartAt || !trialEndAt) {
        return { daysLeft: 0, isActive: false };
    }

    const tz = String(timeZone || "UTC").trim() || "UTC";
    const start = new Date(trialStartAt);
    const end = new Date(trialEndAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        return { daysLeft: 0, isActive: false };
    }

    const nowMs = toZonedTimeMs(now, tz);
    const endMs = toZonedTimeMs(end, tz);
    const diffMs = endMs - nowMs;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysLeft = Math.max(0, Math.ceil(diffMs / oneDayMs));
    return { daysLeft, isActive: daysLeft > 0 };
}
