export type PublicBusiness = {
    business: {
        slug: string;
        name: string;
        phone: string;
        address: string;
    };
    services: Array<{
        id: string;
        name: string;
        durationMinutes: number;
        price: number;
    }>;
    availability: {
        timezone?: string;
        weekStartsOn?: 0 | 1;
        days?: Array<{ day: number; enabled: boolean; start?: string; end?: string }>;
    };
    currency: { code: string; name?: string; symbol?: string };
};

export function currencyLabel(currency: { code: string; symbol?: string; name?: string }): string {
    const code = String(currency?.code ?? "").trim();
    const symbol = String(currency?.symbol ?? "").trim();
    if (symbol) return symbol;
    return code || "";
}

export function formatPrice(args: {
    price: number;
    currency: { code: string; symbol?: string; name?: string };
}): string {
    const value = Number(args.price);
    const label = currencyLabel(args.currency);
    if (!Number.isFinite(value)) return "";
    // Keep simple/stable formatting.
    return label ? `${label}${value}` : String(value);
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
    const tz = String(timeZone || "UTC").trim() || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (!y || !m || !d) return "";
    return `${y}-${m}-${d}`;
}
