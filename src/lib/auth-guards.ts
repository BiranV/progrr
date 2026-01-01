import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/prisma";

/**
 * Enforces subscription policy for Page Loads.
 * - OWNER/CLIENT: Pass.
 * - ADMIN: Must be ACTIVE/TRIALING. If not, redirects to billing.
 */
export async function checkSubscriptionAndRedirect() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // If called in a protected context without session, redirect.
    // But usually middleware catches this.
    return false;
  }

  // Avoid redirect loops
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || "";
  if (pathname.includes("/billing/reactivate")) {
    return true;
  }

  // 1. Fetch Truth from Database
  // Verifying subscription status
  const user = await prisma.user.findUnique({
    where: { auth0Sub: session.user.id },
    select: {
      role: true,
      subscriptionStatus: true,
    },
  });

  if (!user) {
    // User might not be synced yet
    return true;
  }

  // 2. Bypass Logic
  if (user.role === "CLIENT") {
    return true; // Pass
  }

  if (user.role === "OWNER") {
    // Privacy Guard: Owners should not be in the App
    redirect("/owner/dashboard");
  }

  // 3. Admin Subscription Check
  const validStatuses = ["ACTIVE", "TRIALING"];

  if (!validStatuses.includes(user.subscriptionStatus)) {
    // Redirect immediately if not valid
    redirect("/billing/reactivate");
  }

  return true; // Pass
}

/**
 * Enforces subscription policy for Server Actions.
 * Throws error if invalid.
 */
export async function requireActiveSubscription() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { auth0Sub: session.user.id },
    select: {
      role: true,
      subscriptionStatus: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "CLIENT") {
    return true;
  }

  if (user.role === "OWNER") {
    // Owners are allowed to perform actions, but usually they have their own actions.
    // If an owner calls a generic app action, we might allow it or block it.
    // For now, allow it to avoid breaking things if they share logic.
    return true;
  }

  const validStatuses = ["ACTIVE", "TRIALING"];
  if (!validStatuses.includes(user.subscriptionStatus)) {
    throw new Error(
      "Subscription inactive. Please renew to perform this action."
    );
  }

  return true;
}
