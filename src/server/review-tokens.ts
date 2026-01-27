import crypto from "crypto";

export type ReviewTokenPair = {
  token: string;
  tokenHash: string;
};

export function hashReviewToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createReviewToken(): ReviewTokenPair {
  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashReviewToken(token) };
}
