import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTransaction } from "./client.ts";

const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(): Promise<string[]> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied: string[] = [];

  for (const filename of filenames) {
    await withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('anchorpoint-schema-migrations'))",
      );
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const existing = await client.query<{ name: string }>(
        "SELECT name FROM schema_migrations WHERE name = $1",
        [filename],
      );
      if (existing.rowCount) return;

      await client.query(await readFile(resolve(migrationsDirectory, filename), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [filename]);
      applied.push(filename);
    });
  }

  return applied;
}
