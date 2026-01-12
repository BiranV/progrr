import { ObjectId } from "mongodb";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { collections } from "@/server/collections";
import { resolveClientAdminContext } from "@/server/client-relations";
import { type AdminPlan, normalizeAdminPlan } from "@/server/plan-guards";

export type AppUser =
  | {
    id: string;
    email: string;
    full_name: string | null;
    phone?: string;
    role: "admin";
    plan: AdminPlan;
  }
  | {
    id: string;
    email: string;
    full_name: string | null;
    role: "client";
    adminId?: string;
    canSwitchCoach?: boolean;
    phone?: string;
    theme: "light" | "dark";
    status:
    | "PENDING"
    | "PENDING_LIMIT"
    | "ACTIVE"
    | "INACTIVE"
    | "BLOCKED"
    | "ARCHIVED"
    | "DELETED";
    admin?: {
      id: string;
      email: string;
      full_name: string | null;
      phone?: string;
    };
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

    // Backfill default plan for existing data.
    const plan = normalizeAdminPlan((admin as any)?.plan);
    const rawPlan = String((admin as any)?.plan ?? "")
      .trim()
      .toLowerCase();
    if (!rawPlan || rawPlan !== plan) {
      await c.admins.updateOne(
        { _id: admin._id },
        { $set: { plan } }
      );
    }

    return {
      id: admin._id.toHexString(),
      email: admin.email,
      full_name: admin.fullName ?? null,
      phone:
        typeof (admin as any).phone === "string" &&
          String((admin as any).phone).trim()
          ? String((admin as any).phone).trim()
          : undefined,
      role: "admin",
      plan,
    };
  }

  const client = await c.clients.findOne({ _id: new ObjectId(claims.sub) });
  if (!client) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  // Resolve the active coach/admin context for this client.
  // If not resolved, we still treat the session as authenticated but require selection.
  const resolved = await resolveClientAdminContext({
    c,
    user: client,
    claimedAdminId: claims.adminId,
  });

  if (resolved.needsSelection) {
    const message =
      resolved.reason === "NO_RELATIONS" ||
        resolved.reason === "NO_ACTIVE_RELATIONS"
        ? "Your account is not connected to any coach."
        : "Your account no longer has access to this platform. Please contact your coach.";
    throw Object.assign(new Error(message), {
      status: 403,
      code: "CLIENT_BLOCKED",
    });
  }

  const adminId = resolved.activeAdminId.toHexString();

  // Retrieve the Client Entity to get the status (and other business data)
  // We match by email or userId to be robust.
  const entity = await c.entities.findOne({
    entity: "Client",
    adminId: resolved.activeAdminId,
    $or: [
      { "data.email": client.email },
      { "data.userId": client._id.toHexString() },
      { "data.clientAuthId": client._id.toHexString() },
    ],
  });

  const status = (entity?.data?.status ?? "PENDING") as
    | "PENDING"
    | "PENDING_LIMIT"
    | "ACTIVE"
    | "INACTIVE"
    | "BLOCKED"
    | "ARCHIVED"
    | "DELETED";

  // Attach coach contact details for the active admin.
  let adminContact:
    | {
      id: string;
      email: string;
      full_name: string | null;
      phone?: string;
    }
    | undefined;
  {
    const admin = await c.admins.findOne({ _id: resolved.activeAdminId });
    if (admin) {
      adminContact = {
        id: admin._id?.toHexString?.() ? admin._id.toHexString() : adminId,
        email: admin.email,
        full_name: admin.fullName ?? null,
        phone:
          typeof (admin as any).phone === "string" &&
            String((admin as any).phone).trim()
            ? String((admin as any).phone).trim()
            : undefined,
      };
    }
  }

  const canSwitchCoach = resolved.activeRelations.length > 1;

  // Prefer the admin-scoped client profile name for the active coach.
  // This keeps the UI consistent when different coaches created different profile names.
  let preferredFullName: string | null = (client.name ?? null) as any;
  {
    const clientIdStr = client._id.toHexString();
    const escapedEmail = String(client.email || "").replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const clientEntity = await c.entities.findOne({
      entity: "Client",
      adminId: resolved.activeAdminId,
      $or: [
        { "data.userId": clientIdStr },
        { "data.clientAuthId": clientIdStr },
        {
          "data.email": {
            $regex: new RegExp(`^${escapedEmail}$`, "i"),
          },
        },
      ],
    });

    const entityName =
      clientEntity &&
        typeof (clientEntity as any)?.data?.name === "string" &&
        String((clientEntity as any).data.name).trim()
        ? String((clientEntity as any).data.name).trim()
        : null;

    if (entityName) {
      preferredFullName = entityName;
    }
  }

  return {
    id: client._id.toHexString(),
    email: client.email,
    full_name: preferredFullName,
    role: "client",
    status,
    adminId,
    canSwitchCoach,
    phone: client.phone,
    theme: client.theme,
    admin: adminContact,
  };
}
