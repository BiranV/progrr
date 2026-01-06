import { MongoClient, Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __progrrMongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __progrrMongoDb: Db | undefined;
  // eslint-disable-next-line no-var
  var __progrrMongoLoggedReuse: boolean | undefined;
}

const isDev = process.env.NODE_ENV !== "production";

let cachedClientPromise: Promise<MongoClient> | null = null;
let cachedDb: Db | null = null;
let loggedReuseOnce = false;

function shouldLogConnections(): boolean {
  return (
    String(process.env.MONGO_LOG_CONNECTIONS ?? "").toLowerCase() !== "false"
  );
}

function getMongoClientOptions() {
  const maxPoolSizeRaw = String(process.env.MONGODB_MAX_POOL_SIZE ?? "").trim();
  const maxPoolSize = maxPoolSizeRaw ? Number(maxPoolSizeRaw) : undefined;

  return {
    ...(Number.isFinite(maxPoolSize) && maxPoolSize ? { maxPoolSize } : null),
    serverSelectionTimeoutMS: 10_000,
  } as const;
}

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

export async function getMongoClient(): Promise<MongoClient> {
  const uri = requireEnv("MONGODB_URI");
  const options = getMongoClientOptions();
  const log = shouldLogConnections();

  if (isDev) {
    if (!globalThis.__progrrMongoClientPromise) {
      if (log) {
        console.info(
          `[mongo] creating new MongoClient (dev). maxPoolSize=${String(
            (options as any).maxPoolSize ?? "default"
          )}`
        );
      }

      const client = new MongoClient(uri, options);
      globalThis.__progrrMongoClientPromise = client
        .connect()
        .then(() => client)
        .catch((err) => {
          globalThis.__progrrMongoClientPromise = undefined;
          globalThis.__progrrMongoDb = undefined;
          globalThis.__progrrMongoLoggedReuse = undefined;
          throw err;
        });
    } else if (log && !globalThis.__progrrMongoLoggedReuse) {
      console.info("[mongo] reusing existing MongoClient (dev)");
      globalThis.__progrrMongoLoggedReuse = true;
    }

    return globalThis.__progrrMongoClientPromise;
  }

  if (!cachedClientPromise) {
    if (log) {
      console.info(
        `[mongo] creating new MongoClient (prod). maxPoolSize=${String(
          (options as any).maxPoolSize ?? "default"
        )}`
      );
    }

    const client = new MongoClient(uri, options);
    cachedClientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        cachedClientPromise = null;
        cachedDb = null;
        loggedReuseOnce = false;
        throw err;
      });
  } else if (log && !loggedReuseOnce) {
    console.info("[mongo] reusing existing MongoClient (prod)");
    loggedReuseOnce = true;
  }

  return cachedClientPromise;
}

export async function getDb(): Promise<Db> {
  const log = shouldLogConnections();

  if (isDev) {
    if (globalThis.__progrrMongoDb) return globalThis.__progrrMongoDb;

    const client = await getMongoClient();
    const dbName = process.env.MONGODB_DB || undefined;
    const db = dbName ? client.db(dbName) : client.db();
    globalThis.__progrrMongoDb = db;

    if (log) console.info("[mongo] created Db handle (dev)");
    return db;
  }

  if (cachedDb) return cachedDb;

  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB || undefined;
  const db = dbName ? client.db(dbName) : client.db();

  cachedDb = db;
  if (log) console.info("[mongo] created Db handle (prod)");
  return db;
}
