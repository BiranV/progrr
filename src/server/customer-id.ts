import crypto from "node:crypto";

export function customerIdFor(args: {
  businessUserId: string;
  email: string;
}): string {
  const input = `${args.businessUserId}:${args.email}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}
