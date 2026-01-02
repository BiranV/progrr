import { collections } from "@/server/collections";

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

export async function requireOwner() {
  const email = requireEnv("OWNER_EMAIL").trim().toLowerCase();
  const c = await collections();

  const existing = await c.owners.findOne({ email });
  if (existing) return existing;

  const created = await c.owners.insertOne({ email } as any);
  return {
    _id: created.insertedId,
    email,
  };
}
