export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

export function isValidEmail(input: unknown): boolean {
  return EMAIL_REGEX.test(normalizeEmail(input));
}
