import { closePool } from "../packages/db/src/client.ts";
import { migrate } from "../packages/db/src/migrate.ts";

try {
  const applied = await migrate();
  console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database is current.");
} finally {
  await closePool();
}
