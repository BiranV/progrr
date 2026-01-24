import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { DEV_ONBOARDING_COOKIE, DEV_ONBOARDING_USER_ID } from "@/lib/dev-onboarding";

export { DEV_ONBOARDING_COOKIE, DEV_ONBOARDING_USER_ID };

export function isDevOnboardingEnabled() {
    return process.env.NODE_ENV === "development";
}

export function isDevOnboardingRequest(request: NextRequest) {
    if (!isDevOnboardingEnabled()) return false;
    return request.nextUrl.searchParams.get("devOnboarding") === "true";
}

export function isDevOnboardingPath(pathname: string) {
    return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

export function isDevOnboardingStepPath(pathname: string) {
    return /^\/onboarding\/step-\d+\/?$/.test(pathname);
}

export async function readDevOnboardingCookie(): Promise<boolean> {
    if (!isDevOnboardingEnabled()) return false;
    const jar = await cookies();
    return jar.get(DEV_ONBOARDING_COOKIE)?.value === "1";
}

export function readDevOnboardingCookieFromRequest(request: NextRequest): boolean {
    if (!isDevOnboardingEnabled()) return false;
    return request.cookies.get(DEV_ONBOARDING_COOKIE)?.value === "1";
}
