import type { AdminPlan } from "@/types";

export type PlanDefinition = {
    // Numeric limits
    maxClients: number;
    maxPlans: number;

    // Starter-only global totals (admin library)
    maxExercisesTotal?: number;
    maxFoodsTotal?: number;

    // Feature gates
    allowExternalCatalogApi: boolean;
    allowCustomVideoUploads: boolean;
    allowAdminLogo: boolean;
    allowPwaBranding: boolean;

    // Pricing (used by Pricing page)
    priceMonthly: number;
};

export const PLAN_CONFIG: Record<AdminPlan, PlanDefinition> = {
    starter: {
        maxClients: 5,
        maxPlans: 10,
        maxExercisesTotal: 20,
        maxFoodsTotal: 40,
        allowExternalCatalogApi: false,
        allowCustomVideoUploads: false,
        allowAdminLogo: false,
        allowPwaBranding: false,
        priceMonthly: 0,
    },
    basic: {
        maxClients: 20,
        maxPlans: 50,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: false,
        allowAdminLogo: true,
        allowPwaBranding: false,
        priceMonthly: 29,
    },
    professional: {
        maxClients: 100,
        maxPlans: Infinity,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: true,
        allowAdminLogo: true,
        allowPwaBranding: false,
        priceMonthly: 79,
    },
    advanced: {
        maxClients: Infinity,
        maxPlans: Infinity,
        allowExternalCatalogApi: true,
        allowCustomVideoUploads: true,
        allowAdminLogo: true,
        allowPwaBranding: true,
        priceMonthly: 129,
    },
} as const;

export const PLAN_ORDER: readonly AdminPlan[] = [
    "starter",
    "basic",
    "professional",
    "advanced",
] as const;

// Generic fallback (can be used for other entity limits).
export const LIMIT_REACHED_REASON =
    "You’ve reached the limit for your current plan. Upgrade to continue.";

export const AVAILABLE_ON_BASIC_AND_ABOVE = "Available on Basic and above";
export const AVAILABLE_ON_PROFESSIONAL_AND_ABOVE =
    "Available on Professional and above";
export const AVAILABLE_ON_ADVANCED = "Available on Advanced";

export function featureAvailableOnPlanOrAboveMessage(args: {
    feature: string;
    requiredPlan: "Basic" | "Professional" | "Advanced";
}): string {
    const { feature, requiredPlan } = args;
    const suffix =
        requiredPlan === "Advanced"
            ? "available on Advanced"
            : `available on ${requiredPlan} and above`;
    return `${feature} is ${suffix}. Upgrade your subscription to continue.`;
}

export function activeClientLimitReachedMessage(limit: number): string {
    return `You can have up to ${limit} active clients on your current plan. Upgrade plan to add more clients.`;
}

export function restoreClientWouldExceedLimitMessage(limit: number): string {
    return `Restoring this client would exceed your active client limit (${limit}). Please archive another active client or upgrade plan.`;
}
