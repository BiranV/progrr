import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { verifyPassword } from "@/server/password";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const password = String(body?.password ?? "");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const c = await collections();
    const client = await c.clients.findOne({ email });
    if (!client) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!client.passwordHash) {
      return NextResponse.json(
        { error: "Password not set. Please use the email code flow." },
        { status: 409 }
      );
    }

    const ok = await verifyPassword(password, client.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const clientId = client._id!.toHexString();
    const adminId = client.adminId.toHexString();

    const token = await signAuthToken({
      sub: clientId,
      role: "client",
      clientId,
      adminId,
    });

    const res = NextResponse.json({ ok: true });
    setAuthCookie(res, token);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
