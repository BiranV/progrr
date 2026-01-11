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
  // Legacy (password-based auth removed); kept optional for existing data.
  passwordHash?: string;
  createdAt: Date;
  fullName?: string;
  phone?: string;
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
  email: string;
  name: string;
  theme: "light" | "dark";
  role: "client";

  // Legacy: previous model stored a single adminId on the client record.
  // New model stores admin association in client_admin_relations.
  adminId?: ObjectId;

  // Persisted coach selection
  lastActiveAdminId?: ObjectId;
  lastSelectedAt?: Date;

  // Legacy global block fields (deprecated; use client_admin_relations per coach)
  isBlocked?: boolean;
  blockedUntil?: Date | null;
  blockReason?: string | null;

  // Optional login fields
  passwordHash?: string;
  // Optional legacy field (kept for existing data)
  phone?: string;
  // Optional: used by Settings "mock data" tools
  mockSeedId?: string;

  deletedBy?: "ADMIN" | "CLIENT" | null;
};

export type ClientAdminRelationStatus =
  | "ACTIVE"
  | "BLOCKED"
  | "INACTIVE"
  | "PENDING"
  | "DELETED";

export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export type InviteDoc = {
  _id?: ObjectId;
  email: string; // normalized email
  adminId: ObjectId;
  role: "client";
  status: InviteStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  acceptedUserId?: ObjectId;
  // Optional link to the admin-scoped Client entity created during invite.
  clientEntityId?: ObjectId;
};

export type ClientAdminRelationDoc = {
  _id?: ObjectId;
  userId: ObjectId; // client user id (global)
  adminId: ObjectId;
  status: ClientAdminRelationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSelectedAt?: Date;

  // Optional block metadata (only meaningful when status === "BLOCKED")
  blockedUntil?: Date | null;
  blockReason?: string | null;
};

export type EntityDoc = {
  _id?: ObjectId;
  entity: string;
  adminId: ObjectId;
  data: any;
  createdAt: Date;
  updatedAt: Date;
};

export type OtpPurpose =
  | "client_login"
  | "admin_login"
  | "admin_signup"
  | "admin_password_reset"
  | "client_password_reset"
  | "client_onboarding";

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
    owners: db.collection<OwnerDoc>("owners"),
    admins: db.collection<AdminDoc>("admins"),
    clients: db.collection<ClientDoc>("clients"),
    clientAdminRelations: db.collection<ClientAdminRelationDoc>(
      "client_admin_relations"
    ),
    entities: db.collection<EntityDoc>("entities"),
    invites: db.collection<InviteDoc>("invites"),
    otps: db.collection<OtpDoc>("otps"),
    rateLimits: db.collection<RateLimitDoc>("rate_limits"),
  };
}

export async function ensureIndexes() {
  const c = await collections();

  await c.owners.createIndex({ email: 1 }, { unique: true });
  await c.admins.createIndex({ email: 1 }, { unique: true });
  // Drop legacy unique phone indexes to allow email-only auth.
  // (A non-sparse unique index would block multiple docs with missing phone.)
  try {
    await c.clients.dropIndex("phone_1");
  } catch {
    // ignore
  }
  try {
    await c.otps.dropIndex("phone_1");
  } catch {
    // ignore
  }

  await c.clients.createIndex({ email: 1 }, { unique: true });
  await c.clients.createIndex({ adminId: 1 });

  await c.clientAdminRelations.createIndex(
    { userId: 1, adminId: 1 },
    { unique: true }
  );
  await c.clientAdminRelations.createIndex({ userId: 1 });
  await c.clientAdminRelations.createIndex({ adminId: 1 });

  await c.entities.createIndex({ entity: 1, adminId: 1 });
  await c.entities.createIndex({ adminId: 1 });

  // Daily compliance logs: one per client per date.
  // IMPORTANT: This must be a partial index; otherwise it would apply to every
  // entity doc (many don't have clientId/date) and would block inserts.
  await c.entities.createIndex(
    { entity: 1, adminId: 1, "data.clientId": 1, "data.date": 1 },
    {
      unique: true,
      partialFilterExpression: {
        entity: { $in: ["DailyWorkoutLog", "DailyNutritionLog"] },
        "data.clientId": { $type: "string" },
        "data.date": { $type: "string" },
      },
    }
  );

  await c.invites.createIndex({ email: 1, adminId: 1, status: 1 });
  await c.invites.createIndex({ adminId: 1 });
  await c.invites.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await c.otps.createIndex({ key: 1, purpose: 1 }, { unique: true });
  await c.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await c.rateLimits.createIndex({ key: 1 }, { unique: true });
  await c.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
