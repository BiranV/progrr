import { SignJWT, jwtVerify } from "jose";

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
  // Reuse the auth JWT secret; invite tokens are purpose-scoped and cannot be
  // used as auth tokens because they don't include a valid `role` claim.
  const secret = requireEnv("AUTH_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export type ClientInviteTokenClaims = {
  inviteId: string;
  adminId: string;
  email: string;
  kind: "client_invite";
};

export async function signClientInviteToken(args: {
  inviteId: string;
  adminId: string;
  email: string;
  expiresAt: Date;
}) {
  const key = getSecretKey();

  const exp = Math.floor(args.expiresAt.getTime() / 1000);

  return await new SignJWT({
    kind: "client_invite",
    adminId: args.adminId,
    email: args.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.inviteId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifyClientInviteToken(
  token: string
): Promise<ClientInviteTokenClaims> {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);

  const inviteId = typeof payload.sub === "string" ? payload.sub : "";
  const kind = payload.kind;
  const adminId = typeof payload.adminId === "string" ? payload.adminId : "";
  const email = typeof payload.email === "string" ? payload.email : "";

  if (!inviteId || kind !== "client_invite" || !adminId || !email) {
    throw Object.assign(new Error("Invalid invite token"), { status: 400 });
  }

  return { inviteId, adminId, email, kind };
}
