"use server";

import { ObjectId } from "mongodb";
import { collections, ensureIndexes } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import { Client } from "@/types";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/server/email";
import { signClientInviteToken } from "@/server/invite-token";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";

export type ClientFormData = Omit<
  Client,
  "id" | "created_date" | "updated_date"
> & {
  id?: string;
};

function normalizeEmail(email: unknown): string | undefined {
  const v = String(email ?? "")
    .trim()
    .toLowerCase();
  return v ? v : undefined;
}

function normalizeClientGenderCanonical(
  value: unknown
): "male" | "female" | "other" | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const v = raw.toLowerCase().replace(/\s+/g, " ");
  if (v === "male" || v === "m" || v === "man") return "male";
  if (v === "female" || v === "f" || v === "woman") return "female";
  if (v === "other" || v === "nonbinary" || v === "non-binary") return "other";
  return "";
}

function normalizeClientGoalCanonical(
  value: unknown
):
  | "weight_loss"
  | "muscle_gain"
  | "maintenance"
  | "strength"
  | "endurance"
  | "recomposition"
  | "better_habits"
  | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw === "Fat Loss") return "weight_loss";
  if (raw === "Muscle Gain") return "muscle_gain";
  if (raw === "Maintenance") return "maintenance";
  if (raw === "Strength") return "strength";
  if (raw === "Endurance") return "endurance";
  if (raw === "Recomposition") return "recomposition";
  if (raw === "Better Habits") return "better_habits";

  const v = raw
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_");
  if (v === "weight_loss") return "weight_loss";
  if (v === "muscle_gain") return "muscle_gain";
  if (v === "maintenance") return "maintenance";
  if (v === "strength") return "strength";
  if (v === "endurance") return "endurance";
  if (v === "recomposition") return "recomposition";
  if (v === "better_habits") return "better_habits";

  if (v.includes("loss") || v.includes("cut") || v.includes("fat"))
    return "weight_loss";
  if (v.includes("muscle") || v.includes("gain") || v.includes("bulk"))
    return "muscle_gain";
  if (v.includes("maint")) return "maintenance";
  if (v.includes("strength")) return "strength";
  if (v.includes("endur") || v.includes("cardio")) return "endurance";
  if (v.includes("recomp")) return "recomposition";
  if (v.includes("habit") || v.includes("lifestyle")) return "better_habits";
  return "";
}

function normalizeClientActivityCanonical(
  value: unknown
): "sedentary" | "light" | "moderate" | "active" | "very" | "extra" | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw === "Sedentary") return "sedentary";
  if (raw === "Light") return "light";
  if (raw === "Moderate") return "moderate";
  if (raw === "Active") return "active";
  if (raw === "Very Active") return "very";
  if (raw === "Extra Active") return "extra";

  const deCamel = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  const v = deCamel
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (v === "sedentary") return "sedentary";
  if (v === "light") return "light";
  if (v === "moderate") return "moderate";
  if (v === "active") return "active";
  if (v === "very" || v === "very active" || v === "veryactive") return "very";
  if (v === "extra" || v === "extra active" || v === "extraactive")
    return "extra";
  return "";
}

function resolveAppUrlFromEnvOrHeaders(h: Headers): string {
  const fromEnv = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]
    .map((v) => String(v ?? "").trim())
    .find(Boolean);

  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const forwardedProto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
  const host = h.get("host")?.trim() || "";

  const proto = forwardedProto || "http";
  const resolvedHost = forwardedHost || host;
  if (resolvedHost) return `${proto}://${resolvedHost}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

async function assertClientNotSameAsAdminIdentity(args: {
  c: Awaited<ReturnType<typeof collections>>;
  adminEmail: string | undefined;
  clientEmail: string | undefined;
}) {
  const { adminEmail, clientEmail } = args;

  if (!adminEmail || !clientEmail) return;
  if (adminEmail !== clientEmail) return;
  // Email-only auth: client emails must not match the admin's email.
  throw new Error(
    "You cannot create/update a client with the same email as your admin account"
  );
}

function normalizeClientStatusForWrite(
  status: unknown
): "ACTIVE" | "PENDING" | "INACTIVE" | undefined {
  const v = String(status ?? "")
    .trim()
    .toUpperCase();
  if (v === "ACTIVE" || v === "PENDING" || v === "INACTIVE") return v;
  return undefined;
}

function normalizeClientStatusAllowBlocked(
  status: unknown
): "ACTIVE" | "PENDING" | "INACTIVE" | "BLOCKED" | undefined {
  const v = String(status ?? "")
    .trim()
    .toUpperCase();
  if (
    v === "ACTIVE" ||
    v === "PENDING" ||
    v === "INACTIVE" ||
    v === "BLOCKED"
  ) {
    return v;
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function assertBirthDateNotFuture(birthDate: unknown) {
  const v = String(birthDate ?? "").trim();
  if (!v) return;
  // Expect HTML date input format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  if (v > todayYmd()) {
    throw new Error("Birth date cannot be in the future");
  }
}

export async function createClientAction(data: ClientFormData) {
  const adminUser = await requireAppUser();
  if (adminUser.role !== "admin") {
    throw new Error("Only admins can create clients");
  }

  await ensureIndexes();
  const c = await collections();

  const adminId = new ObjectId(adminUser.id);
  const phone = String((data as any).phone ?? "").trim();
  const name = String(data.name ?? "").trim();
  const email = normalizeEmail(data.email);
  // Hard rule: clients created by admins always start as PENDING.
  // They become ACTIVE automatically after the client successfully logs in.
  const status: "PENDING" = "PENDING";

  if (!name) throw new Error("Client name is required");
  if (!email) throw new Error("Client email is required");
  if (!phone) throw new Error("Client phone is required");

  const adminEmail = normalizeEmail(adminUser.email);
  await assertClientNotSameAsAdminIdentity({
    c,
    adminEmail,
    clientEmail: email,
  });

  assertBirthDateNotFuture((data as any).birthDate);

  // Prevent duplicates within the same admin.
  const existingByPhoneOrEmail = await c.entities.findOne({
    entity: "Client",
    adminId,
    $or: [
      {
        "data.email": {
          $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
        },
      },
    ],
  });

  if (existingByPhoneOrEmail) {
    const existingData: any = existingByPhoneOrEmail.data ?? {};
    if (email && normalizeEmail(existingData.email) === email) {
      if (existingData.status === "DELETED") {
        throw new Error(
          "This email belongs to a deleted client. Please find them in the list and restore their account."
        );
      }
      throw new Error("A client with this email already exists");
    }
    throw new Error("A client with this email already exists");
  }

  // Invite-based onboarding: do NOT create login users or relations yet.
  // The client account + admin relation are created only after accepting the invite and verifying OTP.

  // Store full profile in the Entities collection to keep existing UI working.
  // Keep `userId` for backward UI compatibility.
  const clientEntityData: any = {
    ...data,
    email: email ?? "",
    phone,
    name,
    status,
    userId: null,
    clientAuthId: null,
  };

  // Enforce canonical enums (do not store labels)
  clientEntityData.gender =
    normalizeClientGenderCanonical((data as any).gender) ||
    normalizeClientGenderCanonical((clientEntityData as any).gender) ||
    "";
  clientEntityData.goal =
    normalizeClientGoalCanonical((data as any).goal) ||
    normalizeClientGoalCanonical((clientEntityData as any).goal) ||
    "";
  clientEntityData.activityLevel =
    normalizeClientActivityCanonical((data as any).activityLevel) ||
    normalizeClientActivityCanonical((clientEntityData as any).activityLevel) ||
    "";

  const now = new Date();
  const existingEntity = await c.entities.findOne({
    entity: "Client",
    adminId,
    $or: [
      {
        "data.email": {
          $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
        },
      },
    ],
  });

  if (existingEntity) {
    await c.entities.updateOne(
      { _id: existingEntity._id },
      {
        $set: {
          data: clientEntityData,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      }
    );
  } else {
    const insertEntity = await c.entities.insertOne({
      entity: "Client",
      adminId,
      data: clientEntityData,
      createdAt: now,
      updatedAt: now,
    });
    // If we just created the entity, store it for invite linkage.
    (clientEntityData as any).__entityId = insertEntity.insertedId;
  }

  revalidatePath("/clients");

  // Create/resend an invitation email for PENDING clients.
  if (status === "PENDING") {
    const db = await getDb();
    const h = await headers();
    const req = new Request("http://internal/invite", { headers: h });
    await checkRateLimit({
      db,
      req,
      purpose: "invite_create",
      email,
      perIp: { windowMs: 60_000, limit: 10 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    const appUrl = resolveAppUrlFromEnvOrHeaders(h);

    const now = new Date();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const entityId =
      existingEntity?._id ??
      ((clientEntityData as any).__entityId instanceof ObjectId
        ? (clientEntityData as any).__entityId
        : undefined);

    const existingInvite = await c.invites.findOne({
      email,
      adminId,
      status: "PENDING",
      expiresAt: { $gt: now },
    });

    const inviteId = existingInvite?._id
      ? existingInvite._id
      : (
          await c.invites.insertOne({
            email,
            adminId,
            role: "client",
            status: "PENDING",
            expiresAt,
            createdAt: now,
            clientEntityId: entityId,
          } as any)
        ).insertedId;

    // Best-effort: keep clientEntityId updated when reusing an invite.
    if (existingInvite?._id && entityId instanceof ObjectId) {
      await c.invites.updateOne(
        { _id: existingInvite._id },
        { $set: { clientEntityId: entityId } }
      );
    }

    const inviteToken = await signClientInviteToken({
      inviteId: inviteId.toHexString(),
      adminId: adminId.toHexString(),
      email,
      expiresAt: existingInvite?.expiresAt ?? expiresAt,
    });

    const inviteLink = `${appUrl}/invite/${encodeURIComponent(inviteToken)}`;

    await sendEmail({
      to: email,
      subject: "You've been invited to Progrr",
      text: `You've been invited to Progrr.\n\nAccept invitation: ${inviteLink}\n\nThis link expires in 7 days.`,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">You've been invited to Progrr</h2>
          <p style="margin: 0 0 16px;">Click the button below to accept your invitation and verify your email.</p>
          <p style="margin: 0 0 20px;">
            <a
              href="${inviteLink}"
              style="display: inline-block; padding: 10px 14px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;"
            >
              Accept Invitation
            </a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">This link expires in 7 days.</p>
        </div>
      `.trim(),
    });
  }

  return { success: true };
}

export async function resendClientInviteAction(clientId: string) {
  const adminUser = await requireAppUser();
  if (adminUser.role !== "admin") {
    throw new Error("Only admins can resend invites");
  }

  await ensureIndexes();
  const c = await collections();

  if (!ObjectId.isValid(clientId)) throw new Error("Invalid ID");
  const entityId = new ObjectId(clientId);
  const adminId = new ObjectId(adminUser.id);

  const client = await c.entities.findOne({
    _id: entityId,
    entity: "Client",
    adminId,
  });

  if (!client) throw new Error("Client not found");

  const clientData = client.data as any;
  if (clientData.status !== "PENDING") {
    throw new Error("Invite can only be reset for PENDING users");
  }

  const email = clientData.email;
  if (!email) throw new Error("Client has no email");

  // Invalidate old invites
  await c.invites.updateMany(
    { email, adminId, status: "PENDING" },
    { $set: { status: "REVOKED", updatedAt: new Date() } }
  );

  // Create new invite
  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const insertResult = await c.invites.insertOne({
    email,
    adminId,
    role: "client",
    status: "PENDING",
    expiresAt,
    createdAt: now,
    clientEntityId: entityId,
  } as any);

  const inviteId = insertResult.insertedId;
  const h = await headers();
  const appUrl = resolveAppUrlFromEnvOrHeaders(h);

  const inviteToken = await signClientInviteToken({
    inviteId: inviteId.toHexString(),
    adminId: adminId.toHexString(),
    email,
    expiresAt,
  });

  const inviteLink = `${appUrl}/invite/${encodeURIComponent(inviteToken)}`;

  await sendEmail({
    to: email,
    subject: "You've been invited to Progrr",
    text: `You've been invited to Progrr.\n\nAccept invitation: ${inviteLink}\n\nThis link expires in 7 days.`,
    html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">You've been invited to Progrr</h2>
          <p style="margin: 0 0 16px;">Click the button below to accept your invitation and verify your email.</p>
          <p style="margin: 0 0 20px;">
            <a
              href="${inviteLink}"
              style="display: inline-block; padding: 10px 14px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;"
            >
              Accept Invitation
            </a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">This link expires in 7 days.</p>
        </div>
      `.trim(),
  });

  // Update audit fields
  await c.entities.updateOne(
    { _id: entityId },
    {
      $set: {
        "data.lastInviteSentAt": now,
        "data.lastInviteSentBy": adminId,
      },
    }
  );

  return { success: true };
}

export async function updateClientAction(id: string, data: ClientFormData) {
  const adminUser = await requireAppUser();
  if (adminUser.role !== "admin") {
    throw new Error("Only admins can update clients");
  }

  await ensureIndexes();
  const c = await collections();

  if (!ObjectId.isValid(id)) throw new Error("Client not found");

  const adminId = new ObjectId(adminUser.id);
  const entityId = new ObjectId(id);

  const existing = await c.entities.findOne({
    _id: entityId,
    entity: "Client",
    adminId,
  });
  if (!existing) throw new Error("Client not found");

  const phone = String((data as any).phone ?? "").trim();
  const name = String(data.name ?? "").trim();
  const email = normalizeEmail(data.email);
  if (!name) throw new Error("Client name is required");
  if (!email) throw new Error("Client email is required");
  if (!phone) throw new Error("Client phone is required");

  const adminEmail = normalizeEmail(adminUser.email);
  await assertClientNotSameAsAdminIdentity({
    c,
    adminEmail,
    clientEmail: email,
  });

  assertBirthDateNotFuture((data as any).birthDate);

  // Prevent duplicates within the same admin (excluding this client).
  const duplicate = await c.entities.findOne({
    entity: "Client",
    adminId,
    _id: { $ne: entityId },
    $or: [
      {
        "data.email": {
          $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
        },
      },
    ],
  });

  if (duplicate) {
    const dupData: any = duplicate.data ?? {};
    if (email && normalizeEmail(dupData.email) === email) {
      throw new Error("A client with this email already exists");
    }
    throw new Error("A client with this email already exists");
  }

  const oldData = (existing.data ?? {}) as any;
  // Status is system-controlled:
  // - starts as PENDING on admin invite
  // - becomes ACTIVE on first successful client login
  // - becomes BLOCKED only via the admin access endpoint
  // Admin updates should not be able to change status.
  const normalizedStatus =
    normalizeClientStatusAllowBlocked(oldData.status) ?? "ACTIVE";
  const authIdStr = String(oldData.clientAuthId ?? oldData.userId ?? "");

  // If the client already has a global auth record, keep it in sync.
  const clientAuthIdStr = ObjectId.isValid(authIdStr)
    ? new ObjectId(authIdStr).toHexString()
    : null;

  if (clientAuthIdStr) {
    const authObjectId = new ObjectId(authIdStr);

    // Prevent duplicate login emails across clients.
    const existingAuthDup = await c.clients.findOne({
      email: {
        $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
      },
      _id: { $ne: authObjectId },
    });
    if (existingAuthDup) {
      throw new Error("A client with this email already exists");
    }

    try {
      await c.clients.updateOne(
        { _id: authObjectId },
        {
          $set: {
            phone,
            name,
            email,
          },
        }
      );
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new Error("A client with this email already exists");
      }
      throw e;
    }
  }
  const nextData: any = {
    ...(oldData as any),
    ...data,
    email: email ?? "",
    phone,
    name,
    status: normalizedStatus,
    userId: clientAuthIdStr,
    clientAuthId: clientAuthIdStr,
  };

  // Enforce canonical enums (do not store labels)
  nextData.gender =
    normalizeClientGenderCanonical((data as any).gender) ||
    normalizeClientGenderCanonical(oldData.gender) ||
    "";
  nextData.goal =
    normalizeClientGoalCanonical((data as any).goal) ||
    normalizeClientGoalCanonical(oldData.goal) ||
    "";
  nextData.activityLevel =
    normalizeClientActivityCanonical((data as any).activityLevel) ||
    normalizeClientActivityCanonical(oldData.activityLevel) ||
    normalizeClientActivityCanonical((oldData as any).activity_level) ||
    "";

  await c.entities.updateOne(
    { _id: entityId },
    {
      $set: {
        data: nextData,
        updatedAt: new Date(),
      },
    }
  );

  // Only ensure the client<->admin relation exists after the client has a global auth record.
  if (clientAuthIdStr) {
    const now = new Date();
    const authObjectId = new ObjectId(authIdStr);
    await c.clientAdminRelations.updateOne(
      { userId: authObjectId, adminId },
      {
        $setOnInsert: {
          userId: authObjectId,
          adminId,
          status: "ACTIVE",
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  revalidatePath("/clients");
  return { success: true };
}

async function updateClientStatus(
  entityIdStr: string,
  newStatus: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED" | "PENDING"
) {
  const adminUser = await requireAppUser();
  if (adminUser.role !== "admin") throw new Error("Unauthorized");

  await ensureIndexes();
  const c = await collections();

  if (!ObjectId.isValid(entityIdStr)) throw new Error("Invalid ID");
  const entityId = new ObjectId(entityIdStr);
  const adminId = new ObjectId(adminUser.id);

  const existing = await c.entities.findOne({
    _id: entityId,
    entity: "Client",
    adminId,
  });
  if (!existing) throw new Error("Client not found");

  const oldData: any = existing.data || {};
  const authIdStr = String(oldData.clientAuthId ?? oldData.userId ?? "");

  const now = new Date();

  const updateData: any = { "data.status": newStatus, updatedAt: now };

  if (newStatus === "DELETED") {
    updateData["data.deletedBy"] = "ADMIN";
    updateData["data.deletedAt"] = now.toISOString();
  } else if (newStatus === "ACTIVE") {
    updateData["data.deletedBy"] = null;
    updateData["data.deletedAt"] = null;
  }

  await c.entities.updateOne({ _id: entityId }, { $set: updateData });

  // Sync Relation Status
  if (ObjectId.isValid(authIdStr)) {
    const authObjectId = new ObjectId(authIdStr);
    await c.clientAdminRelations.updateOne(
      { userId: authObjectId, adminId },
      { $set: { status: newStatus, updatedAt: now } } // Sync usage
    );
  }

  revalidatePath("/clients");
  return { success: true };
}

export async function activateClientAction(id: string) {
  return updateClientStatus(id, "ACTIVE");
}

export async function deactivateClientAction(id: string) {
  return updateClientStatus(id, "INACTIVE");
}

export async function blockClientAction(id: string) {
  return updateClientStatus(id, "BLOCKED");
}

export async function unblockClientAction(id: string) {
  return updateClientStatus(id, "ACTIVE");
}

export async function deleteClientAction(id: string) {
  return updateClientStatus(id, "DELETED");
}
