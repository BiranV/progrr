import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function withQueryParams(url: string, params: Record<string, string>): string {
  const hasQuery = url.includes("?");
  const prefix = hasQuery ? "&" : "?";
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${url}${prefix}${query}`;
}

const baseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const datasourceUrl = baseUrl
  ? withQueryParams(baseUrl, {
      connection_limit: "1",
      pool_timeout: "0",
    })
  : undefined;

export const prisma =
  global.__prisma ??
  new PrismaClient(
    datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl,
            },
          },
        }
      : undefined
  );

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
