"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(input: string) {
  // Defensive cleanup: remove all whitespace + common zero-width chars.
  const cleaned = input
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
  return cleaned;
}

async function emailExists(email: string) {
  const admin = createAdminClient();
  if (!admin) return null; // not configured

  // For admin-only local app this is fine; avoid unbounded scans.
  const perPage = 200;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    if (users.some((u) => (u.email ?? "").toLowerCase() === email)) {
      return true;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return false;
}

type AdminUserInfo = {
  email: string;
  email_confirmed_at: string | null;
};

async function findUserByEmail(email: string): Promise<AdminUserInfo | null> {
  const admin = createAdminClient();
  if (!admin) {
    // In development, we want to know immediately if the key is missing.
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Cannot check for existing user."
      );
    }
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Cannot check for existing user. Please add it to your .env file to enable duplicate email checks."
    );
    return null;
  }

  const perPage = 200;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found?.email) {
      return {
        email: found.email,
        email_confirmed_at: (found.email_confirmed_at as string | null) ?? null,
      };
    }

    if (users.length < perPage) break;
  }

  return null;
}

export async function signInWithPassword(formData: FormData) {
  const email = normalizeEmail(getString(formData, "email"));
  const password = getString(formData, "password");

  let supabase;
  try {
    supabase = await createClient();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const message =
      err?.code === "SUPABASE_ENV_MISSING"
        ? err.message || "Supabase env is missing."
        : "Authentication is not configured.";
    redirect(`/?authError=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/?authError=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signUpWithPassword(formData: FormData) {
  const fullName = getString(formData, "full_name");
  const email = normalizeEmail(getString(formData, "email"));
  const password = getString(formData, "password");

  if (!fullName) {
    redirect(`/?authError=${encodeURIComponent("Full name is required.")}`);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const message =
      err?.code === "SUPABASE_ENV_MISSING"
        ? err.message || "Supabase env is missing."
        : "Authentication is not configured.";
    redirect(`/?authError=${encodeURIComponent(message)}`);
  }

  // Prevent duplicate signup with an existing email.
  let existing = null;
  try {
    existing = await findUserByEmail(email);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed checking email.";
    redirect(`/?authError=${encodeURIComponent(msg)}`);
  }

  if (existing) {
    // If the user exists but hasn't confirmed email, resend confirmation.
    if (!existing.email_confirmed_at) {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) {
        redirect(`/?authError=${encodeURIComponent(resendError.message)}`);
      }

      redirect(
        `/?authMessage=${encodeURIComponent(
          "This email is already registered but not verified yet. We re-sent the confirmation email. Please check your inbox and spam."
        )}`
      );
    }

    redirect(
      `/?authError=${encodeURIComponent(
        "This email is already registered. Please log in instead."
      )}`
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/?authError=${encodeURIComponent(error.message)}`);
  }

  // If email confirmations are enabled, Supabase won't create a session yet.
  if (!data?.session) {
    redirect(
      `/?authMessage=${encodeURIComponent(
        "Account created. Check your email to confirm, then log in."
      )}`
    );
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
