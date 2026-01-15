import { SignJWT, jwtVerify } from "jose";

export type AuthClaims = {
  sub: string;
  onboardingCompleted?: boolean;
  iat?: number;
};

export type BookingVerifyClaims = {
  purpose: "booking_verify";
  email: string;
  iat?: number;
};

export type BookingCancelClaims = {
  purpose: "booking_cancel";
  appointmentId: string;
  phone: string;
  iat?: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`Missing env: ${name}`), {
      status: 500,
      code: "ENV_MISSING",
    });
  }
  return value;
}

function getSecretKey() {
  const secret = requireEnv("AUTH_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(claims: AuthClaims) {
  const key = getSecretKey();

  return await new SignJWT({
    onboardingCompleted:
      typeof claims.onboardingCompleted === "boolean"
        ? claims.onboardingCompleted
        : undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyAuthToken(token: string): Promise<AuthClaims> {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);

  const sub = typeof payload.sub === "string" ? payload.sub : undefined;

  if (!sub) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;
  const onboardingCompleted =
    typeof (payload as any).onboardingCompleted === "boolean"
      ? Boolean((payload as any).onboardingCompleted)
      : undefined;

  return {
    sub,
    onboardingCompleted,
    iat,
  };
}

export async function signBookingVerifyToken(args: { email: string }) {
  const key = getSecretKey();
  return await new SignJWT({
    purpose: "booking_verify",
    email: args.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("20m")
    .sign(key);
}

export async function verifyBookingVerifyToken(
  token: string
): Promise<BookingVerifyClaims> {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);
  const purpose = (payload as any)?.purpose;
  const email = (payload as any)?.email;
  if (
    purpose !== "booking_verify" ||
    typeof email !== "string" ||
    !email.trim()
  ) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;
  return { purpose: "booking_verify", email: String(email).trim(), iat };
}

export async function signBookingCancelToken(args: {
  appointmentId: string;
  phone: string;
}) {
  const key = getSecretKey();
  return await new SignJWT({
    purpose: "booking_cancel",
    appointmentId: args.appointmentId,
    phone: args.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyBookingCancelToken(
  token: string
): Promise<BookingCancelClaims> {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);
  const purpose = (payload as any)?.purpose;
  const appointmentId = (payload as any)?.appointmentId;
  const phone = (payload as any)?.phone;
  if (
    purpose !== "booking_cancel" ||
    typeof appointmentId !== "string" ||
    !appointmentId.trim() ||
    typeof phone !== "string" ||
    !phone.trim()
  ) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;
  return {
    purpose: "booking_cancel",
    appointmentId: String(appointmentId).trim(),
    phone: String(phone).trim(),
    iat,
  };
}
