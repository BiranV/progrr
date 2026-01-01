"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/server/prisma";
import { requireAppUser } from "@/server/auth";
import { Client } from "@/types";
import { revalidatePath } from "next/cache";

export type ClientFormData = Omit<
  Client,
  "id" | "created_date" | "updated_date"
> & {
  id?: string;
};

export async function createClientAction(data: ClientFormData) {
  console.log("Creating client action started for:", data.email);
  const adminUser = await requireAppUser();
  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    throw new Error("Supabase Admin client not configured");
  }

  const email = data.email.trim().toLowerCase();

  // 1. Check if user exists in Auth
  // We use listUsers to find by email because getUserById requires ID
  // Ideally we would use getUserByEmail but admin api doesn't have it directly exposed in all versions,
  // but listUsers with filter is safer or just try to invite.
  // Actually, inviteUserByEmail handles existence check usually.

  // However, to be precise:
  // "If client already exists in Supabase Auth → do NOT create again."

  // Let's try to invite. If they exist, it might return the user or error depending on config.
  // But safer to check first if we want to avoid re-inviting if not needed?
  // "Send an invite / magic link email so the client can set their password."
  // If they exist, maybe we shouldn't send invite?
  // But if they exist, they might not have a password set?

  // Let's assume we try to invite.
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/invite`,
    });

  let authUser = inviteData.user;

  if (inviteError) {
    // If error is "User already registered", we fetch the user.
    if (
      inviteError.message.includes("already registered") ||
      inviteError.status === 422
    ) {
      // Fetch user by email
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const found = listData.users.find(
        (u) => u.email?.toLowerCase() === email
      );
      if (found) {
        authUser = found;
      } else {
        throw new Error(
          "User exists but could not be found: " + inviteError.message
        );
      }
    } else {
      throw new Error("Failed to invite user: " + inviteError.message);
    }
  }

  if (!authUser) throw new Error("Failed to create/find auth user");

  // 2. Create/Update User record
  // We use upsert to handle case where Auth exists but DB record missing
  // Note: We use email as the unique key for finding the user if ID doesn't match (rare but possible if auth0Sub mismatch)
  // But prisma.user.upsert requires a unique where clause.
  // If we use `where: { id: authUser.id }`, it works if the ID matches.
  // If the user exists with a different ID but same email, upsert will fail on unique constraint of email.

  // So first, let's check if a user with this email exists.
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Update existing user
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        auth0Sub: authUser.id, // Ensure auth ID is synced
        role: "CLIENT",
        coachId: adminUser.id,
        fullName: data.name,
      },
    });
  } else {
    // Create new user
    // We try to use authUser.id as the ID, but if it conflicts with another table (unlikely for UUID), we might need to let DB generate it.
    // But for Supabase Auth sync, keeping IDs same is good.
    await prisma.user.create({
      data: {
        id: authUser.id,
        auth0Sub: authUser.id,
        email: email,
        fullName: data.name,
        role: "CLIENT",
        status: "PENDING",
        coachId: adminUser.id,
      },
    });
  }

  // 3. Create Entity record
  // Check if entity exists for this user to avoid duplicates?
  // The current system seems to allow multiple entities, but for "Client" entity, maybe 1 per user?
  // Let's assume we create a new one if we are in "createClient" flow.
  // But if the user was just found (already existed), maybe they already have a Client entity?
  // If they have a Client entity, we might be duplicating it.
  // But the UI is "Create Client".

  // Let's check if a Client entity exists for this owner.
  const existingEntity = await prisma.entity.findFirst({
    where: {
      entity: "Client",
      ownerId: authUser.id,
    },
  });

  if (existingEntity) {
    // Update existing entity? Or throw?
    // If I am an admin adding an existing user as a client, maybe I just want to link them?
    // But the form has data.
    // Let's update the existing entity with new data.
    await prisma.entity.update({
      where: { id: existingEntity.id },
      data: {
        data: data,
      },
    });
  } else {
    await prisma.entity.create({
      data: {
        entity: "Client",
        ownerId: authUser.id,
        data: data,
      },
    });
  }

  revalidatePath("/clients");
  return { success: true };
}

export async function updateClientAction(id: string, data: ClientFormData) {
  // id is the Entity ID (from ClientDialog)

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!entity) throw new Error("Client not found");

  const userId = entity.ownerId;
  // If no ownerId, we might need to create one?
  // But "Clients are NOT allowed to exist only in the database".
  // So if no ownerId, it's a legacy bad state. We should probably fix it.
  // But we need an email to create Auth user. `data.email` has it.

  const adminUser = await requireAppUser();
  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) throw new Error("Supabase Admin client not configured");

  const newEmail = data.email.trim().toLowerCase();
  let targetUserId = userId;

  if (!targetUserId) {
    // Handle legacy case: Entity exists but no User/Auth.
    // Create Auth user.
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(newEmail, {
        redirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/invite`,
      });
    if (inviteError)
      throw new Error("Failed to invite user: " + inviteError.message);

    targetUserId = inviteData.user.id;

    // Create User record
    await prisma.user.create({
      data: {
        id: targetUserId,
        auth0Sub: targetUserId,
        email: newEmail,
        fullName: data.name,
        role: "CLIENT",
        coachId: adminUser.id,
      },
    });

    // Link Entity
    await prisma.entity.update({
      where: { id },
      data: { ownerId: targetUserId },
    });
  } else {
    // Normal case: User exists.
    const oldEmail = entity.owner?.email?.toLowerCase();

    // 1. Update Auth if email changed
    if (oldEmail && newEmail !== oldEmail) {
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          email: newEmail,
          // Supabase sends confirmation email automatically if email is changed.
        });

      if (updateError)
        throw new Error("Failed to update auth email: " + updateError.message);
    }

    // 2. Update User record
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        email: newEmail,
        fullName: data.name,
      },
    });
  }

  // 3. Update Entity record
  await prisma.entity.update({
    where: { id },
    data: {
      data: data,
    },
  });

  revalidatePath("/clients");
  return { success: true };
}
