import { ObjectId } from "mongodb";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { collections, ensureIndexes } from "@/server/collections";
import {
  DEV_ONBOARDING_USER_ID,
  isDevOnboardingEnabled,
  readDevOnboardingCookie,
} from "@/server/dev-onboarding";

export type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string;
  onboardingCompleted: boolean;
  isDevOnboarding?: boolean;
};

export async function requireAppUser(): Promise<AppUser> {
  const token = await readAuthCookie();
  if (!token) {
    if (isDevOnboardingEnabled() && await readDevOnboardingCookie()) {
      return {
        id: DEV_ONBOARDING_USER_ID,
        email: "dev@local",
        full_name: "Dev Onboarding",
        onboardingCompleted: false,
        isDevOnboarding: true,
      };
    }
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  await ensureIndexes();

  const claims = await verifyAuthToken(token);
  if (isDevOnboardingEnabled() && claims.sub === DEV_ONBOARDING_USER_ID) {
    return {
      id: DEV_ONBOARDING_USER_ID,
      email: "dev@local",
      full_name: "Dev Onboarding",
      onboardingCompleted: false,
      isDevOnboarding: true,
    };
  }
  const c = await collections();

  const user = await c.users.findOne({ _id: new ObjectId(claims.sub) });
  if (!user) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const onboardingCompleted = Boolean((user as any).onboardingCompleted);

  return {
    id: user._id!.toHexString(),
    email: user.email,
    full_name: user.fullName ?? null,
    phone:
      typeof (user as any).phone === "string" && String((user as any).phone).trim()
        ? String((user as any).phone).trim()
        : undefined,
    onboardingCompleted,
  };
}
