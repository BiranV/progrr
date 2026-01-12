import { ObjectId } from "mongodb";
import type {
  collections,
  ClientDoc,
  ClientAdminRelationDoc,
} from "@/server/collections";

export type ResolvedClientAdminContext =
  | {
    needsSelection: true;
    activeAdminId: null;
    activeRelation: null;
    activeRelations: ClientAdminRelationDoc[];
    reason: "NO_RELATIONS" | "NO_ACTIVE_RELATIONS" | "LAST_ACTIVE_INVALID";
  }
  | {
    needsSelection: false;
    activeAdminId: ObjectId;
    activeRelation: ClientAdminRelationDoc;
    activeRelations: ClientAdminRelationDoc[];
    reason: "SINGLE_RELATION" | "LAST_ACTIVE";
  };

function isRelationBlocked(rel: ClientAdminRelationDoc, now = new Date()) {
  const status = String((rel as any)?.status ?? "ACTIVE")
    .trim()
    .toUpperCase();
  if (status !== "BLOCKED") return false;
  const until = rel.blockedUntil ?? null;
  if (until instanceof Date && until.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

function isRelationEffectivelyActive(
  rel: ClientAdminRelationDoc,
  now = new Date()
) {
  const status = String((rel as any)?.status ?? "ACTIVE")
    .trim()
    .toUpperCase();

  if (status === "ACTIVE") return true;
  if (status === "PENDING" || status === "PENDING_LIMIT") return true;
  // Treat expired blocks as active (status cleanup can happen elsewhere).
  if (status === "BLOCKED" && !isRelationBlocked(rel, now)) return true;
  return false;
}

export async function ensureLegacySingleRelation(args: {
  c: Awaited<ReturnType<typeof collections>>;
  user: ClientDoc;
}) {
  const { c, user } = args;
  if (!user._id) return;

  // Legacy: if the old client doc had a single adminId, migrate it lazily.
  const legacyAdminId = (user as any).adminId;
  if (!(legacyAdminId instanceof ObjectId)) return;

  // Only migrate if the legacy admin still exists.
  // Otherwise, drop the deprecated field to prevent resurrecting deleted/phantom relations.
  const adminStillExists = await c.admins.findOne(
    { _id: legacyAdminId },
    { projection: { _id: 1 } }
  );
  if (!adminStillExists) {
    await c.clients.updateOne({ _id: user._id }, { $unset: { adminId: "" } });
    return;
  }

  // If the user already has relations (e.g. a new coach added them under the new model),
  // we still must ensure the legacy coach relation exists as well.
  const alreadyHasLegacyRelation = await c.clientAdminRelations.findOne({
    userId: user._id,
    adminId: legacyAdminId,
  });
  if (alreadyHasLegacyRelation) {
    // Prevent future re-migrations from resurrecting deleted relations.
    await c.clients.updateOne({ _id: user._id }, { $unset: { adminId: "" } });
    return;
  }

  const now = new Date();
  await c.clientAdminRelations.updateOne(
    { userId: user._id, adminId: legacyAdminId },
    {
      $setOnInsert: {
        userId: user._id,
        adminId: legacyAdminId,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  // Prevent future re-migrations from resurrecting deleted relations.
  await c.clients.updateOne({ _id: user._id }, { $unset: { adminId: "" } });
}

export async function resolveClientAdminContext(args: {
  c: Awaited<ReturnType<typeof collections>>;
  user: ClientDoc;
  claimedAdminId?: string | undefined;
}): Promise<ResolvedClientAdminContext> {
  const { c, user, claimedAdminId } = args;
  if (!user._id) {
    return {
      needsSelection: true,
      activeAdminId: null,
      activeRelation: null,
      activeRelations: [],
      reason: "NO_RELATIONS",
    };
  }

  await ensureLegacySingleRelation({ c, user });

  const all = await c.clientAdminRelations
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  if (all.length === 0) {
    return {
      needsSelection: true,
      activeAdminId: null,
      activeRelation: null,
      activeRelations: [],
      reason: "NO_RELATIONS",
    };
  }

  const now = new Date();
  const active = all.filter((r) => isRelationEffectivelyActive(r, now));

  if (active.length === 0) {
    return {
      needsSelection: true,
      activeAdminId: null,
      activeRelation: null,
      activeRelations: [],
      reason: "NO_ACTIVE_RELATIONS",
    };
  }

  if (active.length === 1) {
    return {
      needsSelection: false,
      activeAdminId: active[0].adminId,
      activeRelation: active[0],
      activeRelations: active,
      reason: "SINGLE_RELATION",
    };
  }

  // Resolve a candidate active admin.
  const candidates: ObjectId[] = [];

  if (claimedAdminId && ObjectId.isValid(claimedAdminId)) {
    candidates.push(new ObjectId(claimedAdminId));
  }

  const persisted = (user as any).lastActiveAdminId;
  if (persisted instanceof ObjectId) {
    candidates.push(persisted);
  }

  for (const adminId of candidates) {
    const rel = active.find((r) => r.adminId.equals(adminId));
    if (!rel) continue;

    return {
      needsSelection: false,
      activeAdminId: rel.adminId,
      activeRelation: rel,
      activeRelations: active,
      reason: "LAST_ACTIVE",
    };
  }

  // Default to the most recently created active relation.
  return {
    needsSelection: false,
    activeAdminId: active[0].adminId,
    activeRelation: active[0],
    activeRelations: active,
    reason: "LAST_ACTIVE",
  };
}

export async function setLastActiveAdmin(args: {
  c: Awaited<ReturnType<typeof collections>>;
  userId: ObjectId;
  adminId: ObjectId;
}) {
  const { c, userId, adminId } = args;
  const now = new Date();

  await c.clients.updateOne(
    { _id: userId },
    {
      $set: {
        lastActiveAdminId: adminId,
        lastSelectedAt: now,
      },
    }
  );

  await c.clientAdminRelations.updateOne(
    { userId, adminId },
    {
      $set: {
        lastSelectedAt: now,
        updatedAt: now,
      },
    }
  );
}
