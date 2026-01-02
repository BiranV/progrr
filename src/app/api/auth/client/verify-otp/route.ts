import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const code = String(body?.code ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    const c = await collections();

    const client = await c.clients.findOne({ phone });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const otp = await c.otps.findOne({ phone });
    if (!otp) {
      return NextResponse.json(
        { error: "Code expired or not requested" },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.otps.deleteOne({ phone });
      return NextResponse.json({ error: "Code expired" }, { status: 400 });
    }

    if (otp.attempts >= 5) {
      await c.otps.deleteOne({ phone });
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.otps.updateOne({ phone }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    await c.otps.deleteOne({ phone });

    const clientId = client._id.toHexString();
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
