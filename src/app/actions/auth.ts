"use server";

import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { requireOwner } from "@/server/owner";
import { hashPassword, verifyPassword } from "@/server/password";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookieInAction } from "@/server/auth-cookie";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(input: string) {
  return input
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

export async function signInWithPassword(formData: FormData) {
  const email = normalizeEmail(getString(formData, "email"));
  const password = getString(formData, "password");

  try {
    await ensureIndexes();
    const c = await collections();

    const admin = await c.admins.findOne({ email });
    if (!admin) {
      throw new Error("Invalid credentials");
    }

    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) {
      throw new Error("Invalid credentials");
    }

    const adminId = admin._id.toHexString();
    const token = await signAuthToken({ sub: adminId, role: "admin", adminId });
    await setAuthCookieInAction(token);
  } catch (e: any) {
    redirect(`/?authError=${encodeURIComponent(e?.message || "Login failed")}`);
  }

  redirect("/dashboard");
}

export async function signUpWithPassword(formData: FormData) {
  // Hard requirement: email OTP only (no direct signup without verification).
  // Signup is now handled by the client-side flow calling:
  // - /api/auth/admin/send-otp
  // - /api/auth/admin/verify-otp
  void formData;
  redirect(
    `/?tab=signup&authError=${encodeURIComponent(
      "Email verification is required. Please use the email code flow."
    )}`
  );
}
