import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/prisma";

export type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "client" | "owner";
};

export async function requireAppUser(options?: {
  skipSubscriptionCheck?: boolean;
}): Promise<AppUser> {
  const supabase: Awaited<ReturnType<typeof createClient>> =
    await createClient();

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const subject = authUser.id;
  const email = authUser.email;

  if (!subject || !email) {
    throw Object.assign(new Error("Supabase session missing sub/email"), {
      status: 401,
    });
  }

  let fullNameFromAuth: string | null = null;
  try {
    const metadata = authUser.user_metadata as
      | { full_name?: unknown; fullName?: unknown }
      | undefined;
    const candidate =
      (typeof metadata?.full_name === "string"
        ? metadata.full_name
        : undefined) ??
      (typeof metadata?.fullName === "string" ? metadata.fullName : undefined);
    fullNameFromAuth = candidate?.trim() ? candidate.trim() : null;
  } catch {
    // Ignore metadata failures; we can still authenticate.
  }

  // 1. Try to find user by their Auth ID (subject)
  let user = await prisma.user.findUnique({
    where: { auth0Sub: subject },
  });

  if (!user) {
    // 2. If not found by ID, check if a user with this email already exists
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // 3a. User exists by email -> Update their ID
      user = await prisma.user.update({
        where: { email },
        data: {
          auth0Sub: subject,
          // Do NOT overwrite role
          ...(fullNameFromAuth ? { fullName: fullNameFromAuth } : {}),
        },
      });
    } else {
      // 3b. Create new user. Default to ADMIN (Coach).
      user = await prisma.user.create({
        data: {
          auth0Sub: subject,
          email,
          fullName: fullNameFromAuth,
          role: "ADMIN",
        },
      });
    }
  } else {
    // 4. User found -> Update details, preserve role
    user = await prisma.user.update({
      where: { auth0Sub: subject },
      data: {
        email,
        ...(fullNameFromAuth ? { fullName: fullNameFromAuth } : {}),
      },
    });
  }

  // Enforce Subscription for ADMINs
  if (!options?.skipSubscriptionCheck && user.role === "ADMIN") {
    const validStatuses = ["ACTIVE", "TRIALING"];
    if (!validStatuses.includes(user.subscriptionStatus)) {
      throw Object.assign(new Error("Subscription inactive"), { status: 403 });
    }
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? null,
    role:
      user.role === "OWNER"
        ? "owner"
        : user.role === "CLIENT"
        ? "client"
        : "admin",
  };
}
