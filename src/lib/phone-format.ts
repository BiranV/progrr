import { parsePhoneNumber } from "react-phone-number-input";

export function formatPhoneNumber(phone: string | null | undefined, locale?: string): string {
    const raw = String(phone ?? "").trim();
    if (!raw) return "";

    try {
        const parsed = parsePhoneNumber(raw);
        if (!parsed) return raw;
        const national = parsed.formatNational?.();
        if (!national) return raw;
        return national.replace(/\s+/g, "-");
    } catch {
        return raw;
    }
}
