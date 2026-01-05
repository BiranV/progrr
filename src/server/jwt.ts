import { SignJWT, jwtVerify } from "jose";

export type AuthRole = "admin" | "client";

export type AuthClaims = {
  sub: string;
  role: AuthRole;
  adminId?: string;
  clientId?: string;
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
    role: claims.role,
    adminId: claims.adminId,
    clientId: claims.clientId,
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
  const role = payload.role;

  if (!sub || (role !== "admin" && role !== "client")) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }

  const adminId =
    typeof payload.adminId === "string" ? payload.adminId : undefined;
  const clientId =
    typeof payload.clientId === "string" ? payload.clientId : undefined;
  const iat = typeof payload.iat === "number" ? payload.iat : undefined;

  return {
    sub,
    role,
    adminId,
    clientId,
    iat,
  };
}
