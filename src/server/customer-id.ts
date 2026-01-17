import crypto from "node:crypto";

export function customerIdFor(args: {
  businessUserId: string;
  email: string;
}): string {
  const normalizedEmail = String(args.email ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();

  const input = `${args.businessUserId}:${normalizedEmail}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}
