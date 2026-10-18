import { Pool, type PoolClient } from "pg";

const localDatabaseUrl = "postgres://anchorpoint:anchorpoint@localhost:5433/anchorpoint";
let singleton: Pool | undefined;

export function databaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }
  return localDatabaseUrl;
}

export function pool(): Pool {
  singleton ??= new Pool({ connectionString: databaseUrl(), max: 10 });
  return singleton;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!singleton) return;
  await singleton.end();
  singleton = undefined;
}
