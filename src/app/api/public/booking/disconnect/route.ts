import { NextResponse } from "next/server";

import {
  CUSTOMER_ACCESS_COOKIE_NAME,
  clearCustomerAccessCookieOptions,
} from "@/server/customer-access";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    CUSTOMER_ACCESS_COOKIE_NAME,
    "",
    clearCustomerAccessCookieOptions()
  );
  return res;
}
