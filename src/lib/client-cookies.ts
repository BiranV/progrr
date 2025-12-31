export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    const key = index >= 0 ? cookie.slice(0, index) : cookie;
    if (key === name) {
      const value = index >= 0 ? cookie.slice(index + 1) : "";
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function setCookie(
  name: string,
  value: string,
  options?: { maxAgeSeconds?: number }
) {
  if (typeof document === "undefined") return;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    "samesite=lax",
  ];
  if (options?.maxAgeSeconds) {
    parts.push(`max-age=${options.maxAgeSeconds}`);
  }
  document.cookie = parts.join("; ");
}

export function getAllCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const out: Record<string, string> = {};
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    const key = index >= 0 ? cookie.slice(0, index) : cookie;
    const value = index >= 0 ? cookie.slice(index + 1) : "";
    out[key] = decodeURIComponent(value);
  }
  return out;
}
