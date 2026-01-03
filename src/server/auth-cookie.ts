import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "progrr_token";

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    ...AUTH_COOKIE_OPTIONS,
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

// Server Actions do not propagate Set-Cookie from internal fetch() calls to the browser.
// Use these helpers to mutate cookies on the actual action response.
export async function setAuthCookieInAction(token: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

export async function clearAuthCookieInAction() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
}

export async function readAuthCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE_NAME)?.value;
  return value ?? null;
}
