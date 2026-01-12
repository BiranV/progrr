import { ObjectId } from "mongodb";
import { collections } from "@/server/collections";
import {
    activeClientLimitReachedMessage,
    featureAvailableOnPlanOrAboveMessage,
    LIMIT_REACHED_REASON,
    PLAN_CONFIG,
    restoreClientWouldExceedLimitMessage,
} from "@/config/plans";
import type { AdminPlan } from "@/types";

export type GuardResult = {
    allowed: boolean;
    reason?: string;
};

export type { AdminPlan };

export function normalizeAdminPlan(value: unknown): AdminPlan {
    const v = String(value ?? "")
        .trim()
        .toLowerCase();

    // Back-compat: previous plan names.
    if (v === "free") return "starter";

    if (v === "starter" || v === "basic" || v === "professional" || v === "advanced") {
        return v;
    }
    return "starter";
}

export function planToPublicName(plan: AdminPlan): string {
    if (plan === "starter") return "Starter";
    if (plan === "basic") return "Basic";
    if (plan === "professional") return "Professional";
    return "Advanced";
}

function limitToPublic(limit: number): number | "unlimited" {
    return Number.isFinite(limit) ? limit : "unlimited";
}

async function countActiveClients(args: {
    adminId: ObjectId;
    excludeEntityId?: ObjectId;
}): Promise<number> {
    const c = await collections();
    return c.entities.countDocuments({
        entity: "Client",
        adminId: args.adminId,
        ...(args.excludeEntityId ? { _id: { $ne: args.excludeEntityId } } : {}),
        "data.status": "ACTIVE",
        "data.isDeleted": { $ne: true },
    });
}

export async function getActiveClientCountForAdmin(args: {
    adminId: ObjectId;
    excludeClientEntityId?: ObjectId;
}): Promise<number> {
    return countActiveClients({
        adminId: args.adminId,
        excludeEntityId: args.excludeClientEntityId,
    });
}

async function countNonDeletedPlans(args: { adminId: ObjectId }): Promise<number> {
    const c = await collections();
    return c.entities.countDocuments({
        entity: { $in: ["WorkoutPlan", "MealPlan"] },
        adminId: args.adminId,
        $or: [
            { "data.status": { $exists: false } },
            { "data.status": { $ne: "DELETED" } },
        ],
    });
}

export async function getAdminPlanForUser(args: {
    adminId: ObjectId;
}): Promise<AdminPlan> {
    const c = await collections();
    const admin = await c.admins.findOne({ _id: args.adminId });
    return normalizeAdminPlan((admin as any)?.plan);
}

export async function ensureAdminHasDefaultPlan(args: {
    adminId: ObjectId;
}): Promise<AdminPlan> {
    const c = await collections();
    const admin = await c.admins.findOne({ _id: args.adminId });
    const normalized = normalizeAdminPlan((admin as any)?.plan);
    const current = String((admin as any)?.plan ?? "")
        .trim()
        .toLowerCase();

    if (!admin) return "starter";

    if (current !== normalized) {
        await c.admins.updateOne(
            { _id: args.adminId },
            { $set: { plan: normalized } }
        );
    } else if (!current) {
        await c.admins.updateOne({ _id: args.adminId }, { $set: { plan: "starter" } });
    }

    return normalized;
}

export async function canCreateClient(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const limit = PLAN_CONFIG[plan].maxClients;
    if (!Number.isFinite(limit)) return { allowed: true };

    const adminId = new ObjectId(admin.id);
    const used = await countActiveClients({ adminId });
    if (used >= limit) {
        return { allowed: false, reason: activeClientLimitReachedMessage(limit) };
    }

    return { allowed: true };
}

export async function canRestoreClient(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const limit = PLAN_CONFIG[plan].maxClients;
    if (!Number.isFinite(limit)) return { allowed: true };

    const adminId = new ObjectId(admin.id);
    const used = await countActiveClients({ adminId });
    if (used >= limit) {
        return { allowed: false, reason: restoreClientWouldExceedLimitMessage(limit) };
    }

    return { allowed: true };
}

export async function canActivateClientForAdminId(args: {
    adminId: ObjectId;
    excludeClientEntityId?: ObjectId;
}): Promise<GuardResult> {
    const plan = await getAdminPlanForUser({ adminId: args.adminId });
    const limit = PLAN_CONFIG[plan].maxClients;
    if (!Number.isFinite(limit)) return { allowed: true };

    const used = await countActiveClients({
        adminId: args.adminId,
        excludeEntityId: args.excludeClientEntityId,
    });
    if (used >= limit) {
        return { allowed: false, reason: activeClientLimitReachedMessage(limit) };
    }
    return { allowed: true };
}

export async function canCreatePlan(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const limit = PLAN_CONFIG[plan].maxPlans;
    if (!Number.isFinite(limit)) return { allowed: true };

    const adminId = new ObjectId(admin.id);
    const used = await countNonDeletedPlans({ adminId });
    if (used >= limit) {
        return { allowed: false, reason: LIMIT_REACHED_REASON };
    }

    return { allowed: true };
}

export async function canUseExternalCatalogApi(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_CONFIG[plan];
    if (def.allowExternalCatalogApi) return { allowed: true };

    return {
        allowed: false,
        reason: featureAvailableOnPlanOrAboveMessage({
            feature: "External Exercises/Foods catalog access",
            requiredPlan: "Basic",
        }),
    };
}

export async function canUploadCustomVideo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_CONFIG[plan];
    if (def.allowCustomVideoUploads) return { allowed: true };

    return {
        allowed: false,
        reason: featureAvailableOnPlanOrAboveMessage({
            feature: "Custom video uploads",
            requiredPlan: "Professional",
        }),
    };
}

// Admin logo (shown to clients in-app and emails). Basic+.
export async function canSetAdminLogo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_CONFIG[plan];
    if (def.allowAdminLogo) return { allowed: true };

    return {
        allowed: false,
        reason: featureAvailableOnPlanOrAboveMessage({
            feature: "Admin logo",
            requiredPlan: "Basic",
        }),
    };
}

// PWA icon/splash branding. Advanced only.
export async function canCustomizePwaAppLogo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_CONFIG[plan];
    if (def.allowPwaBranding) return { allowed: true };

    return {
        allowed: false,
        reason: featureAvailableOnPlanOrAboveMessage({
            feature: "App branding for clients",
            requiredPlan: "Advanced",
        }),
    };
}

export async function getPlanGuardsForAdmin(args: {
    adminId: string;
    plan?: unknown;
}) {
    const admin = { id: args.adminId, plan: args.plan };

    const plan = normalizeAdminPlan(args.plan);
    const def = PLAN_CONFIG[plan];

    const [clientGuard, planGuard, externalApiGuard, videoGuard, adminLogoGuard, pwaLogoGuard] = await Promise.all([
        canCreateClient(admin),
        canCreatePlan(admin),
        canUseExternalCatalogApi(admin),
        canUploadCustomVideo(admin),
        canSetAdminLogo(admin),
        canCustomizePwaAppLogo(admin),
    ]);

    return {
        plan,
        planName: planToPublicName(plan),
        limits: {
            maxClients: limitToPublic(def.maxClients),
            maxPlans: limitToPublic(def.maxPlans),
        },
        guards: {
            canCreateClient: clientGuard,
            canCreatePlan: planGuard,
            canUseExternalCatalogApi: externalApiGuard,
            canUploadCustomVideo: videoGuard,
            canSetAdminLogo: adminLogoGuard,
            canCustomizePwaAppLogo: pwaLogoGuard,
        },
    };
}
