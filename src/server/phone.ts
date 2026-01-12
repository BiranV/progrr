export function normalizePhone(input: unknown): string {
    // Keep this intentionally simple and stable:
    // - strip spaces/punctuation
    // - keep leading '+' if present
    // For production, swap to libphonenumber-js E.164 normalization.
    const raw = String(input ?? "").trim();
    if (!raw) return "";

    const plus = raw.startsWith("+");
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return plus ? `+${digits}` : digits;
}

export function isLikelyValidPhone(phone: string): boolean {
    const p = normalizePhone(phone);
    // Very loose validation; enough to stop empty/garbage.
    return p.length >= 8 && p.length <= 16;
}
