"use server";

import { prisma } from "@/server/prisma";
import { createClient } from "@/lib/supabase/server";

export async function activateUserAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE" },
  });

  return { success: true };
}
