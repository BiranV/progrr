import crypto from "crypto";

export type OtpRecord = {
  key: string;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

function randomNumericCode(length: number) {
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += digits[Math.floor(Math.random() * digits.length)];
  }
  return out;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`Missing env: ${name}`), {
      status: 500,
      code: "ENV_MISSING",
    });
  }
  return value;
}

function hmac(input: string) {
  const secret = requireEnv("OTP_SECRET");
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

export function generateOtp(length: 4 | 5 | 6 = 6) {
  const code = randomNumericCode(length);
  return { code, hash: hmac(code) };
}

export function verifyOtp(code: string, expectedHash: string) {
  return hmac(code) === expectedHash;
}
