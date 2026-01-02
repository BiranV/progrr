import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookie } from "@/server/auth-cookie";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url));
  clearAuthCookie(res);
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookie(res);
  return res;
}
