// Free-plan Clay round trip, step 1 (docs/research/georgia-clay-people-pass.md,
// "Automated round trip (free plan)"). Reads Companies from the local Attio mirror of
// ATTIO_CONNECTION_ID (run `npm run attio:sync` first) and writes Clay-ready CSVs to the
// gitignored data/georgia-sample/private/clay/attio/input/ folder, 50 rows per file because a
// free-plan table runs only its first 50 rows. Reads the local database only; never calls Attio.
//
//   --missing-only   only Companies without a domain or a primary location
//   --chunk <n>      rows per file (default 50)
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadAttioPeopleAndCompanies } from "../packages/db/src/attio-mirror.ts";
import { closePool } from "../packages/db/src/client.ts";
import { companyExportRow, EXPORT_COLUMNS, toCsv, toWritebackRecord } from "./clay-attio-mapping.ts";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch {
  // The variables may already be in the environment.
}

const { values: args } = parseArgs({
  options: { "missing-only": { type: "boolean", default: false }, chunk: { type: "string", default: "50" } },
});
const chunk = Number.parseInt(args.chunk, 10);
const connectionId = process.env.ATTIO_CONNECTION_ID;
if (!connectionId || !(chunk > 0)) {
  console.error(!connectionId ? "Set ATTIO_CONNECTION_ID to read the Attio mirror." : "--chunk must be a positive number.");
  process.exit(1);
}

const outDir = resolve(import.meta.dirname, "..", "data", "georgia-sample", "private", "clay", "attio", "input");

try {
  const { companies } = await loadAttioPeopleAndCompanies(connectionId);
  const rows = companies
    .map((payload) => companyExportRow(toWritebackRecord(payload, {})))
    .filter((row) => !args["missing-only"] || row.needs_domain === "true" || row.needs_location === "true")
    .sort((a, b) => a.company_name.localeCompare(b.company_name) || a.attio_company_id.localeCompare(b.attio_company_id));
  if (rows.length === 0) {
    console.error(`No mirrored Companies to export for ${connectionId}. Run npm run attio:sync first.`);
    process.exitCode = 1;
  } else {
    await mkdir(outDir, { recursive: true });
    // Old chunks would otherwise linger beside a smaller export.
    for (const file of await readdir(outDir)) if (/^companies-\d+\.csv$/.test(file)) await rm(resolve(outDir, file));
    const files = Math.ceil(rows.length / chunk);
    for (let index = 0; index < files; index++) {
      await writeFile(resolve(outDir, `companies-${index + 1}.csv`), toCsv(rows.slice(index * chunk, (index + 1) * chunk), EXPORT_COLUMNS));
    }
    const missingDomain = rows.filter((row) => row.needs_domain === "true").length;
    const missingLocation = rows.filter((row) => row.needs_location === "true").length;
    console.log(`Wrote ${rows.length} Companies in ${files} file(s) to ${outDir}; ${missingDomain} need a domain, ${missingLocation} a location.`);
  }
} finally {
  await closePool();
}
