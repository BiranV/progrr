import { ObjectId } from "mongodb";
import { getDb } from "@/server/mongo";

export type OwnerDoc = {
  _id?: ObjectId;
  email: string;
};

export type AdminDoc = {
  _id?: ObjectId;
  ownerId: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
  fullName?: string;
  role: "admin";

  // Optional billing fields (kept for compatibility with existing UI/actions)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?:
    | "ACTIVE"
    | "TRIALING"
    | "PAST_DUE"
    | "CANCELED"
    | "UNPAID";
  subscriptionEndDate?: Date;
};

export type ClientDoc = {
  _id?: ObjectId;
  adminId: ObjectId;
  phone: string;
  name: string;
  theme: "light" | "dark";
  role: "client";
  // Optional legacy/extra fields (kept for UI continuity)
  email?: string;
  // Optional: used by Settings "mock data" tools
  mockSeedId?: string;
};

export type EntityDoc = {
  _id?: ObjectId;
  entity: string;
  adminId: ObjectId;
  data: any;
  createdAt: Date;
  updatedAt: Date;
};

export type OtpDoc = {
  _id?: ObjectId;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

export async function collections() {
  const db = await getDb();
  return {
    owners: db.collection<OwnerDoc>("owners"),
    admins: db.collection<AdminDoc>("admins"),
    clients: db.collection<ClientDoc>("clients"),
    entities: db.collection<EntityDoc>("entities"),
    otps: db.collection<OtpDoc>("otps"),
  };
}

export async function ensureIndexes() {
  const c = await collections();

  await c.owners.createIndex({ email: 1 }, { unique: true });
  await c.admins.createIndex({ email: 1 }, { unique: true });
  await c.clients.createIndex({ phone: 1 }, { unique: true });
  await c.clients.createIndex({ adminId: 1 });

  await c.entities.createIndex({ entity: 1, adminId: 1 });
  await c.entities.createIndex({ adminId: 1 });

  await c.otps.createIndex({ phone: 1 }, { unique: true });
  await c.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
