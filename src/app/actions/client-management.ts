"use server";

import { ObjectId } from "mongodb";
import { collections, ensureIndexes } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import { Client } from "@/types";
import { revalidatePath } from "next/cache";

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

function normalizePhone(phone: unknown): string {
  return String(phone ?? "").trim();
}

function normalizeClientStatus(
  status: unknown
): "ACTIVE" | "PENDING" | "INACTIVE" | undefined {
  const v = String(status ?? "")
    .trim()
    .toUpperCase();
  if (v === "ACTIVE" || v === "PENDING" || v === "INACTIVE") return v;
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
  const phone = normalizePhone(data.phone);
  const name = String(data.name ?? "").trim();
  const email = normalizeEmail(data.email);
  const status = normalizeClientStatus(data.status);

  if (!name) throw new Error("Client name is required");
  if (!email) throw new Error("Client email is required");
  if (!phone) throw new Error("Client phone is required");
  if (!status) throw new Error("Client status is required");

  assertBirthDateNotFuture((data as any).birthDate);

  // Prevent duplicates within the same admin.
  const existingByPhoneOrEmail = await c.entities.findOne({
    entity: "Client",
    adminId,
    $or: [
      { "data.phone": phone },
      {
        "data.email": {
          $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
        },
      },
    ],
  });

  if (existingByPhoneOrEmail) {
    const existingData: any = existingByPhoneOrEmail.data ?? {};
    if (normalizePhone(existingData.phone) === phone) {
      throw new Error("A client with this phone already exists");
    }
    if (email && normalizeEmail(existingData.email) === email) {
      throw new Error("A client with this email already exists");
    }
    throw new Error("A client with this phone or email already exists");
  }

  // Create the login record. Hard rule: phone is the login key.
  const existingAuthClient = await c.clients.findOne({ phone });

  let clientAuthId: ObjectId;
  if (existingAuthClient) {
    if (!existingAuthClient.adminId.equals(adminId)) {
      throw new Error(
        "A client with this phone already belongs to another admin"
      );
    }
    throw new Error("A client with this phone already exists");
  } else {
    const insert = await c.clients.insertOne({
      adminId,
      phone,
      name,
      email,
      theme: "light",
      role: "client",
    });
    clientAuthId = insert.insertedId;
  }

  const clientAuthIdStr = clientAuthId.toHexString();

  // Store full profile in the Entities collection to keep existing UI working.
  // Keep `userId` for backward UI compatibility.
  const clientEntityData: any = {
    ...data,
    email: email ?? "",
    phone,
    name,
    status,
    userId: clientAuthIdStr,
    clientAuthId: clientAuthIdStr,
  };

  const now = new Date();
  const existingEntity = await c.entities.findOne({
    entity: "Client",
    adminId,
    $or: [
      { "data.userId": clientAuthIdStr },
      { "data.clientAuthId": clientAuthIdStr },
      { "data.phone": phone },
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
    await c.entities.insertOne({
      entity: "Client",
      adminId,
      data: clientEntityData,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/clients");
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

  const phone = normalizePhone(data.phone);
  const name = String(data.name ?? "").trim();
  const email = normalizeEmail(data.email);
  if (!name) throw new Error("Client name is required");
  if (!email) throw new Error("Client email is required");
  if (!phone) throw new Error("Client phone is required");

  assertBirthDateNotFuture((data as any).birthDate);

  // Prevent duplicates within the same admin (excluding this client).
  const duplicate = await c.entities.findOne({
    entity: "Client",
    adminId,
    _id: { $ne: entityId },
    $or: [
      { "data.phone": phone },
      {
        "data.email": {
          $regex: new RegExp(`^${escapeRegExp(email)}$`, "i"),
        },
      },
    ],
  });

  if (duplicate) {
    const dupData: any = duplicate.data ?? {};
    if (normalizePhone(dupData.phone) === phone) {
      throw new Error("A client with this phone already exists");
    }
    if (email && normalizeEmail(dupData.email) === email) {
      throw new Error("A client with this email already exists");
    }
    throw new Error("A client with this phone or email already exists");
  }

  const oldData = (existing.data ?? {}) as any;
  const normalizedStatus =
    normalizeClientStatus(data.status) ??
    normalizeClientStatus(oldData.status) ??
    "ACTIVE";
  const authIdStr = String(oldData.clientAuthId ?? oldData.userId ?? "");

  let clientAuthId: ObjectId;
  if (ObjectId.isValid(authIdStr)) {
    clientAuthId = new ObjectId(authIdStr);
  } else {
    // Legacy recovery: if the entity didn't have a login record, create one.
    const insert = await c.clients.insertOne({
      adminId,
      phone,
      name,
      email,
      theme: "light",
      role: "client",
    });
    clientAuthId = insert.insertedId;
  }

  try {
    await c.clients.updateOne(
      { _id: clientAuthId, adminId },
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
      throw new Error("A client with this phone already exists");
    }
    throw e;
  }

  const clientAuthIdStr = clientAuthId.toHexString();
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

  await c.entities.updateOne(
    { _id: entityId },
    {
      $set: {
        data: nextData,
        updatedAt: new Date(),
      },
    }
  );

  revalidatePath("/clients");
  return { success: true };
}
