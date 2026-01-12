"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

export type PlanGuard = { allowed: boolean; reason?: string };

export type PlanGuardsResponse = {
    plan: "free" | "basic" | "professional" | "advanced";
    planName: string;
    limits: {
        maxClients: number | "unlimited";
        maxPlans: number | "unlimited";
    };
    guards: {
        canCreateClient: PlanGuard;
        canCreatePlan: PlanGuard;
        canUseExternalCatalogApi: PlanGuard;
        canUploadCustomVideo: PlanGuard;
        canSetAdminLogo: PlanGuard;
        canCustomizePwaAppLogo: PlanGuard;
    };
};

async function fetchPlanGuards(): Promise<PlanGuardsResponse> {
    const res = await fetch("/api/me/plan-guards", {
        method: "GET",
        credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body as PlanGuardsResponse;
}

export function usePlanGuards(enabled: boolean = true) {
    const query = useQuery({
        queryKey: ["planGuards"],
        queryFn: fetchPlanGuards,
        enabled,
        staleTime: 2_000,
    });

    const upgradeMessage = React.useMemo(() => {
        const g = query.data?.guards;
        return (
            g?.canCreateClient?.reason ||
            g?.canCreatePlan?.reason ||
            g?.canUseExternalCatalogApi?.reason ||
            g?.canUploadCustomVideo?.reason ||
            g?.canSetAdminLogo?.reason ||
            g?.canCustomizePwaAppLogo?.reason ||
            ""
        );
    }, [query.data]);

    return {
        ...query,
        upgradeMessage,
    };
}
