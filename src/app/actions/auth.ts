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
  const fullName = getString(formData, "full_name");
  const email = normalizeEmail(getString(formData, "email"));
  const password = getString(formData, "password");

  if (!fullName) {
    redirect(
      `/?tab=signup&authError=${encodeURIComponent("Full name is required.")}`
    );
  }

  try {
    await ensureIndexes();
    const owner = await requireOwner();
    const c = await collections();

    const existing = await c.admins.findOne({ email });
    if (existing) {
      throw new Error(
        "This email is already registered. Please log in instead."
      );
    }

    const passwordHash = await hashPassword(password);

    const insert = await c.admins.insertOne({
      ownerId: new ObjectId(owner._id),
      email,
      passwordHash,
      createdAt: new Date(),
      fullName: fullName || undefined,
      role: "admin",
    } as any);

    const adminId = insert.insertedId.toHexString();
    const token = await signAuthToken({ sub: adminId, role: "admin", adminId });
    await setAuthCookieInAction(token);
  } catch (e: any) {
    redirect(
      `/?tab=signup&authError=${encodeURIComponent(
        e?.message || "Signup failed"
      )}`
    );
  }

  redirect("/dashboard");
}
