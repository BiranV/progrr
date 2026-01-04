import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Password reset has been removed. Please use the email code (OTP) login flow.",
    },
    { status: 410 }
  );
}
