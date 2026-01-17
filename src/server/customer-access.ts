export const CUSTOMER_ACCESS_COOKIE_NAME = "progrr_customer_access";

// 60 days
export const CUSTOMER_ACCESS_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export function customerAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_ACCESS_MAX_AGE_SECONDS,
  };
}

export function clearCustomerAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
