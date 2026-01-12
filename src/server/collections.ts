import { ObjectId } from "mongodb";
import { getDb } from "@/server/mongo";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
  fullName?: string;
  phone?: string;
  onboardingCompleted?: boolean;
  onboarding?: {
    businessTypes?: string[];
    currency?: string;
    customCurrency?: {
      name?: string;
      symbol?: string;
    };
    business?: {
      name?: string;
      phone?: string;
      address?: string;
    };
    services?: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price?: number;
    }>;
    availability?: {
      timezone?: string;
      weekStartsOn?: 0 | 1;
      days?: Array<{
        day: number; // 0-6 (Sun-Sat)
        enabled: boolean;
        start?: string; // HH:mm
        end?: string; // HH:mm
      }>;
    };
    updatedAt?: Date;
  };
  onboardingCompletedAt?: Date;
};

export type OtpPurpose =
  | "login"
  | "signup";

export type OtpDoc = {
  _id?: ObjectId;
  key: string; // normalized email
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
};

export type RateLimitDoc = {
  _id?: ObjectId;
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
};

export async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    otps: db.collection<OtpDoc>("otps"),
    rateLimits: db.collection<RateLimitDoc>("rate_limits"),
  };
}

export async function ensureIndexes() {
  const c = await collections();

  await c.users.createIndex({ email: 1 }, { unique: true });

  await c.otps.createIndex({ key: 1, purpose: 1 }, { unique: true });
  await c.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await c.rateLimits.createIndex({ key: 1 }, { unique: true });
  await c.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
