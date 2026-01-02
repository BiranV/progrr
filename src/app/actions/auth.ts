"use server";

import { redirect } from "next/navigation";

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

async function postJson(path: string, body: any) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    // Important: include cookies set by route handlers
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = normalizeEmail(getString(formData, "email"));
  const password = getString(formData, "password");

  try {
    await postJson("/api/auth/admin/login", { email, password });
  } catch (e: any) {
    redirect(`/?authError=${encodeURIComponent(e?.message || "Login failed")}`);
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

  try {
    await postJson("/api/auth/admin/signup", {
      email,
      password,
      full_name: fullName,
    });
  } catch (e: any) {
    redirect(
      `/?authError=${encodeURIComponent(e?.message || "Signup failed")}`
    );
  }

  redirect("/dashboard");
}
