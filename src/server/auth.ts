import { ObjectId } from "mongodb";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { collections } from "@/server/collections";

export type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string;
  onboardingCompleted: boolean;
};

export async function requireAppUser(): Promise<AppUser> {
  const token = await readAuthCookie();
  if (!token) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const claims = await verifyAuthToken(token);
  const c = await collections();

  const user = await c.users.findOne({ _id: new ObjectId(claims.sub) });
  if (!user) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  return {
    id: user._id!.toHexString(),
    email: user.email,
    full_name: user.fullName ?? null,
    phone:
      typeof (user as any).phone === "string" && String((user as any).phone).trim()
        ? String((user as any).phone).trim()
        : undefined,
    onboardingCompleted: Boolean((user as any).onboardingCompleted),
  };
}
