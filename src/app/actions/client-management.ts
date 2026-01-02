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
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite`,
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
  // The Entity should be owned by the ADMIN (Coach) so they can see it in their dashboard.
  // We store the client's User ID in the data for reference.

  // Check if a Client entity exists for this admin with this email.
  // Note: Prisma JSON filtering syntax depends on version, but we can fetch and filter or use raw.
  // For simplicity and safety, let's fetch all clients for this admin and find the one.
  // (Assuming a coach doesn't have thousands of clients, this is fine for now).
  const adminClients = await prisma.entity.findMany({
    where: {
      entity: "Client",
      ownerId: adminUser.id,
    },
  });

  const existingEntity = adminClients.find((e: any) => {
    const d = e.data as any;
    return d.email?.toLowerCase() === email;
  });

  const clientData = {
    ...data,
    userId: authUser.id, // Link to the actual User record
    status: "PENDING", // Ensure status is set
  };

  if (existingEntity) {
    await prisma.entity.update({
      where: { id: existingEntity.id },
      data: {
        data: clientData,
      },
    });
  } else {
    await prisma.entity.create({
      data: {
        entity: "Client",
        ownerId: adminUser.id, // Owned by Admin
        data: clientData,
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
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite`,
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

export async function resendInviteAction(email: string) {
  console.log("Resending invite to:", email);
  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    console.error("Supabase Admin client not configured");
    throw new Error("Supabase Admin client not configured");
  }

  // Ensure we use the correct base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUrl = `${baseUrl}/invite`;
  console.log("Redirect URL:", redirectUrl);

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("Supabase invite error:", error);
    throw new Error("Failed to resend invite: " + error.message);
  }

  return { success: true };
}
