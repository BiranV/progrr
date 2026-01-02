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

  // Prisma User.id is an internal UUID; Supabase Auth user id is stored in User.auth0Sub.
  // (Some flows also create User.id = auth id, but we must not rely on it.)
  await prisma.user.update({
    where: { auth0Sub: user.id },
    data: { status: "ACTIVE" },
  });

  // Ensure the coach-facing Client entity flips to active as well.
  // Entities are owned by the coach, so we update by data.userId.
  const allClientEntities = await prisma.entity.findMany({
    where: { entity: "Client" },
  });

  const mine = allClientEntities.filter((e) => {
    const d = (e.data ?? {}) as any;
    return d.userId === user.id;
  });

  await Promise.all(
    mine.map((e) => {
      const d = (e.data ?? {}) as any;
      return prisma.entity.update({
        where: { id: e.id },
        data: {
          data: {
            ...d,
            status: "active",
          },
        },
      });
    })
  );

  return { success: true };
}
