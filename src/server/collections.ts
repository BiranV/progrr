import { ObjectId } from "mongodb";
import { getDb } from "@/server/mongo";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
  fullName?: string;
  phone?: string;
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
