import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

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
  if (cachedClient) return cachedClient;

  const uri = requireEnv("MONGODB_URI");
  const client = new MongoClient(uri);
  await client.connect();

  cachedClient = client;
  return client;
}

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB || undefined;
  const db = dbName ? client.db(dbName) : client.db();

  cachedDb = db;
  return db;
}
