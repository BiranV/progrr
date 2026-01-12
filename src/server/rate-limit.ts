import type { Db } from "mongodb";

export type RateLimitRule = {
  windowMs: number;
  limit: number;
};

type RateLimitDoc = {
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function bucketId(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs);
}

function bucketExpiresAt(bucket: number, windowMs: number): Date {
  // Keep buckets around slightly longer than the window so TTL cleanup is reliable.
  return new Date((bucket + 2) * windowMs);
}

async function hitOrThrow(args: {
  db: Db;
  key: string;
  rule: RateLimitRule;
}): Promise<void> {
  const { db, key, rule } = args;
  const nowMs = Date.now();
  const bucket = bucketId(nowMs, rule.windowMs);
  const bucketKey = `${key}:b:${bucket}`;

  const doc = await db.collection<RateLimitDoc>("rate_limits").findOneAndUpdate(
    { key: bucketKey },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        key: bucketKey,
        createdAt: new Date(nowMs),
        expiresAt: bucketExpiresAt(bucket, rule.windowMs),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!doc) return;
  if (doc.count > rule.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(((bucket + 1) * rule.windowMs - nowMs) / 1000)
    );
    throw Object.assign(
      new Error(
        `Too many requests. Try again in ${retryAfterSeconds} seconds.`
      ),
      {
        status: 429,
        retryAfterSeconds,
      }
    );
  }
}

export async function checkRateLimit(args: {
  db: Db;
  req: Request;
  purpose: string;
  email?: string;
  perIp: RateLimitRule;
  perEmail: RateLimitRule;
}): Promise<void> {
  const ip = getClientIp(args.req);

  await hitOrThrow({
    db: args.db,
    key: `rl:${args.purpose}:ip:${ip}`,
    rule: args.perIp,
  });

  if (args.email) {
    const normalizedEmail = String(args.email)
      .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
      .trim()
      .toLowerCase();

    if (normalizedEmail) {
      await hitOrThrow({
        db: args.db,
        key: `rl:${args.purpose}:email:${normalizedEmail}`,
        rule: args.perEmail,
      });
    }
  }
}

export async function checkRateLimitPhone(args: {
  db: Db;
  req: Request;
  purpose: string;
  phone?: string;
  perIp: RateLimitRule;
  perPhone: RateLimitRule;
}): Promise<void> {
  const ip = getClientIp(args.req);

  await hitOrThrow({
    db: args.db,
    key: `rl:${args.purpose}:ip:${ip}`,
    rule: args.perIp,
  });

  const phone = String(args.phone ?? "")
    .replace(/[^\d+]/g, "")
    .trim();
  if (phone) {
    await hitOrThrow({
      db: args.db,
      key: `rl:${args.purpose}:phone:${phone}`,
      rule: args.perPhone,
    });
  }
}
