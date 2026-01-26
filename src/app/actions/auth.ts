"use server";

import { redirect } from "next/navigation";

// Password-based auth has been removed (OTP-only).

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInWithPassword(formData: FormData) {
  void formData;
  redirect(
    `/?tab=login&authError=${encodeURIComponent(
      "Password login has been removed. Please use the email code (OTP) login flow."
    )}`
  );
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
