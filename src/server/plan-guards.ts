import { ObjectId } from "mongodb";
import { collections } from "@/server/collections";

export type AdminPlan = "free" | "basic" | "professional" | "advanced";

export type GuardResult = {
    allowed: boolean;
    reason?: string;
};

type PlanDefinition = {
    maxClients: number;
    maxPlans: number;
    allowExternalCatalogApi: boolean;
    allowCustomVideoUploads: boolean;
    allowAdminLogo: boolean;
    allowPwaBranding: boolean;
};

export const PLAN_DEFINITIONS: Record<AdminPlan, PlanDefinition> = {
    free: {
        maxClients: 10,
        maxPlans: 20,
        allowExternalCatalogApi: false,
        allowCustomVideoUploads: false,
        allowAdminLogo: false,
        allowPwaBranding: false,
    },
    basic: {
        maxClients: 20,
        maxPlans: 50,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: false,
        allowAdminLogo: true,
        allowPwaBranding: false,
    },
    professional: {
        maxClients: 100,
        maxPlans: Infinity,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: false,
        allowAdminLogo: true,
        allowPwaBranding: false,
    },
    advanced: {
        maxClients: Infinity,
        maxPlans: Infinity,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: true,
        allowAdminLogo: true,
        allowPwaBranding: true,
    },
};

// Single source of truth for numeric limits, as requested.
export const planLimits = {
    free: { clients: 10, plans: 20 },
    basic: { clients: 20, plans: 50 },
    professional: { clients: 100, plans: Infinity },
    advanced: { clients: Infinity, plans: Infinity },
} as const;

const LIMIT_REACHED_REASON =
    "You’ve reached the limit for your current plan. Upgrade to continue.";

export function normalizeAdminPlan(value: unknown): AdminPlan {
    const v = String(value ?? "")
        .trim()
        .toLowerCase();

    // Back-compat: previous plan names.
    if (v === "starter") return "free";

    if (v === "free" || v === "basic" || v === "professional" || v === "advanced") {
        return v;
    }
    return "free";
}

export function planToPublicName(plan: AdminPlan): string {
    if (plan === "free") return "Free";
    if (plan === "basic") return "Basic";
    if (plan === "professional") return "Professional";
    return "Advanced";
}

function limitToPublic(limit: number): number | "unlimited" {
    return Number.isFinite(limit) ? limit : "unlimited";
}

async function countNonDeletedClients(args: {
    adminId: ObjectId;
}): Promise<number> {
    const c = await collections();
    return c.entities.countDocuments({
        entity: "Client",
        adminId: args.adminId,
        $and: [
            {
                $or: [
                    { "data.status": { $exists: false } },
                    { "data.status": { $ne: "DELETED" } },
                ],
            },
            { "data.isDeleted": { $ne: true } },
        ],
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

    if (!admin) return "free";

    if (current !== normalized) {
        await c.admins.updateOne(
            { _id: args.adminId },
            { $set: { plan: normalized } }
        );
    } else if (!current) {
        await c.admins.updateOne({ _id: args.adminId }, { $set: { plan: "free" } });
    }

    return normalized;
}

export async function canCreateClient(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const limit = planLimits[plan].clients;
    if (!Number.isFinite(limit)) return { allowed: true };

    const adminId = new ObjectId(admin.id);
    const used = await countNonDeletedClients({ adminId });
    if (used >= limit) {
        return { allowed: false, reason: LIMIT_REACHED_REASON };
    }

    return { allowed: true };
}

export async function canCreatePlan(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const limit = planLimits[plan].plans;
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
    const def = PLAN_DEFINITIONS[plan];
    if (def.allowExternalCatalogApi) return { allowed: true };

    return {
        allowed: false,
        reason:
            "External Exercises/Foods catalog access is available on Basic and above. Upgrade to continue.",
    };
}

export async function canUploadCustomVideo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_DEFINITIONS[plan];
    if (def.allowCustomVideoUploads) return { allowed: true };

    return {
        allowed: false,
        reason: "Custom video uploads are available on Advanced. Upgrade to continue.",
    };
}

// Admin logo (shown to clients in-app and emails). Basic+.
export async function canSetAdminLogo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_DEFINITIONS[plan];
    if (def.allowAdminLogo) return { allowed: true };

    return {
        allowed: false,
        reason: "Admin logo is available on Basic and above. Upgrade to continue.",
    };
}

// PWA icon/splash branding. Advanced only.
export async function canCustomizePwaAppLogo(admin: {
    id: string;
    plan?: unknown;
}): Promise<GuardResult> {
    const plan = normalizeAdminPlan(admin.plan);
    const def = PLAN_DEFINITIONS[plan];
    if (def.allowPwaBranding) return { allowed: true };

    return {
        allowed: false,
        reason: "PWA app logo customization is available on Advanced. Upgrade to continue.",
    };
}

export async function getPlanGuardsForAdmin(args: {
    adminId: string;
    plan?: unknown;
}) {
    const admin = { id: args.adminId, plan: args.plan };

    const plan = normalizeAdminPlan(args.plan);
    const def = PLAN_DEFINITIONS[plan];

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
