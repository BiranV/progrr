import { ObjectId } from "mongodb";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { collections } from "@/server/collections";

export type AppUser =
  | {
      id: string;
      email: string;
      full_name: string | null;
      role: "admin";
    }
  | {
      id: string;
      email: string;
      full_name: string | null;
      role: "client";
      adminId: string;
      phone?: string;
      theme: "light" | "dark";
    };

export async function requireAppUser(): Promise<AppUser> {
  const token = await readAuthCookie();
  if (!token) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const claims = await verifyAuthToken(token);
  const c = await collections();

  if (claims.role === "admin") {
    const admin = await c.admins.findOne({
      _id: new ObjectId(claims.sub),
    });
    if (!admin) {
      throw Object.assign(new Error("Not authenticated"), { status: 401 });
    }

    return {
      id: admin._id.toHexString(),
      email: admin.email,
      full_name: admin.fullName ?? null,
      role: "admin",
    };
  }

  const client = await c.clients.findOne({ _id: new ObjectId(claims.sub) });
  if (!client) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  return {
    id: client._id.toHexString(),
    email: client.email,
    full_name: client.name ?? null,
    role: "client",
    adminId: client.adminId.toHexString(),
    phone: client.phone,
    theme: client.theme,
  };
}
