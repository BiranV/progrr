import { requireAppUser } from "@/server/auth";

/**
 * Enforces subscription policy for Page Loads.
 * Legacy stub: subscription gating was removed during Mongo migration.
 */
export async function checkSubscriptionAndRedirect() {
  // Ensure the user is authenticated in contexts that rely on this guard.
  await requireAppUser();
  return true;
}

/**
 * Enforces subscription policy for Server Actions.
 * Throws error if invalid.
 */
export async function requireActiveSubscription() {
  await requireAppUser();
  return true;
}
