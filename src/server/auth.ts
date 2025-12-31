import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/prisma";

export type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "client";
};

export async function requireAppUser(): Promise<AppUser> {
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

  // Admin-only app for now: every authenticated user is an admin.
  const role = "ADMIN" as const;

  // 1. Try to find user by their Auth ID (subject)
  let user = await prisma.user.findUnique({
    where: { auth0Sub: subject },
  });

  if (!user) {
    // 2. If not found by ID, check if a user with this email already exists
    // This handles cases where the user exists but has a different ID (or no ID yet)
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // 3a. User exists by email -> Update their ID to match the current login
      user = await prisma.user.update({
        where: { email },
        data: {
          auth0Sub: subject,
          role,
          ...(fullNameFromAuth ? { fullName: fullNameFromAuth } : {}),
        },
      });
    } else {
      // 3b. No user by ID or Email -> Create a brand new user
      user = await prisma.user.create({
        data: {
          auth0Sub: subject,
          email,
          fullName: fullNameFromAuth,
          role,
        },
      });
    }
  } else {
    // 4. User found by ID -> Just update their details
    user = await prisma.user.update({
      where: { auth0Sub: subject },
      data: {
        email,
        role,
        ...(fullNameFromAuth ? { fullName: fullNameFromAuth } : {}),
      },
    });
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? null,
    role: "admin",
  };
}
