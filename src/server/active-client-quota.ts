import { ObjectId } from "mongodb";

import { collections } from "@/server/collections";
import { getMongoClient } from "@/server/mongo";
import { getAdminPlanForUser, normalizeAdminPlan } from "@/server/plan-guards";
import { PLAN_CONFIG } from "@/config/plans";

export type ActiveClientSlotResult = {
    allowed: boolean;
    plan: "free" | "basic" | "professional" | "advanced";
    limit: number;
    reason?: string;
};

async function countStrictActiveClients(args: {
    adminId: ObjectId;
    session?: any;
}): Promise<number> {
    const c = await collections();
    return c.entities.countDocuments(
        {
            entity: "Client",
            adminId: args.adminId,
            "data.status": "ACTIVE",
            "data.isDeleted": { $ne: true },
        },
        args.session ? { session: args.session } : undefined
    );
}

async function getPlanAndLimit(args: { adminId: ObjectId }) {
    const plan = await getAdminPlanForUser({ adminId: args.adminId });
    const limit = PLAN_CONFIG[plan].maxClients;
    return {
        plan,
        limit: Number.isFinite(limit) ? Number(limit) : Infinity,
    } as const;
}

export async function tryAcquireActiveClientSlot(args: {
    adminId: ObjectId;
}): Promise<ActiveClientSlotResult> {
    const { plan, limit } = await getPlanAndLimit({ adminId: args.adminId });
    if (!Number.isFinite(limit)) {
        return { allowed: true, plan, limit };
    }

    const client = await getMongoClient();
    const session = client.startSession();
    try {
        let acquired = false;
        await session.withTransaction(async () => {
            const c = await collections();

            const admin = await c.admins.findOne(
                { _id: args.adminId },
                { session, projection: { plan: 1, activeClientCount: 1 } as any }
            );

            const normalized = normalizeAdminPlan((admin as any)?.plan);
            const effectiveLimitRaw = PLAN_CONFIG[normalized].maxClients;
            const effectiveLimit = Number.isFinite(effectiveLimitRaw)
                ? Number(effectiveLimitRaw)
                : Infinity;

            if (!Number.isFinite(effectiveLimit)) {
                acquired = true;
                return;
            }

            const cached = Number((admin as any)?.activeClientCount);
            const actual = await countStrictActiveClients({ adminId: args.adminId, session });
            const current = Number.isFinite(cached) ? Math.max(cached, actual) : actual;

            // Ensure the cached field is present and never under-counts.
            if (!Number.isFinite(cached) || cached !== current) {
                await c.admins.updateOne(
                    { _id: args.adminId } as any,
                    { $set: { activeClientCount: current } as any },
                    { session }
                );
            }

            if (current >= effectiveLimit) {
                acquired = false;
                return;
            }

            const update = await c.admins.updateOne(
                { _id: args.adminId, activeClientCount: current } as any,
                { $set: { activeClientCount: current + 1 } as any },
                { session }
            );

            acquired = update.modifiedCount === 1;
        });

        if (!acquired) {
            return {
                allowed: false,
                plan,
                limit,
                reason: `You’ve reached your active client limit (${limit}). Upgrade your plan to add more clients.`,
            };
        }

        return { allowed: true, plan, limit };
    } finally {
        await session.endSession();
    }
}

export async function releaseActiveClientSlot(args: {
    adminId: ObjectId;
}): Promise<void> {
    const client = await getMongoClient();
    const session = client.startSession();
    try {
        await session.withTransaction(async () => {
            const c = await collections();
            const actual = await countStrictActiveClients({ adminId: args.adminId, session });
            const next = Math.max(0, actual - 1);
            await c.admins.updateOne(
                { _id: args.adminId } as any,
                { $set: { activeClientCount: next } as any },
                { session }
            );
        });
    } finally {
        await session.endSession();
    }
}
