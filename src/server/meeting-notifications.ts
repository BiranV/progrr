import { ObjectId } from "mongodb";

export const OTHER_CLIENT_ID = "__PROSPECT__";

export function shouldNotifyMeetingClient(rawClientId: unknown): rawClientId is string {
    const clientId = String(rawClientId ?? "").trim();
    if (!clientId) return false;
    if (clientId === OTHER_CLIENT_ID) return false;
    return ObjectId.isValid(clientId);
}

export function pickLocaleFromAcceptLanguage(
    acceptLanguageHeader: string | null
): string | undefined {
    const raw = String(acceptLanguageHeader ?? "").trim();
    if (!raw) return undefined;

    const first = raw.split(",")[0]?.trim();
    if (!first) return undefined;

    // Strip optional quality value, e.g. "en-US;q=0.9".
    const locale = first.split(";")[0]?.trim();
    return locale || undefined;
}

export function formatMeetingDateTimeForLocale(
    date: Date,
    locale?: string
): string {
    try {
        return new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    } catch {
        // Fallback if Intl rejects locale.
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    }
}

export function buildMeetingScheduledMessage(params: {
    meetingTitle: string;
    scheduledAt: Date;
    locale?: string;
}): { title: string; body: string; text: string } {
    const title = "Meeting scheduled";
    const when = formatMeetingDateTimeForLocale(params.scheduledAt, params.locale);

    const meetingTitle = String(params.meetingTitle ?? "").trim() || "(Untitled meeting)";
    const body = `${meetingTitle}\n${when}`;
    const text = `${title}\n${body}`;

    return { title, body, text };
}
