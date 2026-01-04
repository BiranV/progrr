import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // This legacy endpoint created admins without email verification.
  // Hard requirement: email OTP only for all auth flows.
  await req.json().catch(() => ({}));
  return NextResponse.json(
    {
      error:
        "Email verification required. Use /api/auth/admin/send-otp then /api/auth/admin/verify-otp.",
    },
    { status: 410 }
  );
}
