import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(
    input: unknown,
    opts?: { defaultCountry?: string }
): string {
    const raw = String(input ?? "").trim();
    if (!raw) return "";

    const cleaned = raw.replace(/[^\d+]/g, "");
    if (!cleaned) return "";

    const defaultCountry = String(opts?.defaultCountry ?? "IL").toUpperCase();

    if (cleaned.startsWith("+")) {
        const parsed = parsePhoneNumberFromString(cleaned);
        if (!parsed || !parsed.isValid()) return "";
        return parsed.number;
    }

    // Legacy support: digits-only values that already include the country calling code.
    // Example: "972501234567" (stored for wa.me) should be treated as "+972501234567".
    if (/^\d{8,16}$/.test(cleaned)) {
        const asInternational = parsePhoneNumberFromString(`+${cleaned}`);
        if (asInternational?.isValid()) return asInternational.number;
    }

    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as any);

    if (!parsed || !parsed.isValid()) return "";
    return parsed.number; // E.164
}

export function isLikelyValidPhone(phone: string): boolean {
    return Boolean(normalizePhone(phone));
}

export function isMobilePhoneE164(phone: string): boolean {
    const e164 = normalizePhone(phone);
    if (!e164) return false;

    const parsed = parsePhoneNumberFromString(e164);
    const t = parsed?.getType?.();
    return t === "MOBILE" || t === "FIXED_LINE_OR_MOBILE";
}
