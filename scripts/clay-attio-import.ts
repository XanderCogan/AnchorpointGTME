// Free-plan Clay round trip, last step (docs/research/georgia-clay-people-pass.md,
// "Automated round trip (free plan)"). Reads one CSV exported from Clay, maps it to
// company and person enrichments, and plans the Attio writeback against the local mirror
// and writeback ledger. DRY RUN BY DEFAULT: it prints the plan and writes nothing. Only
// --live sends writes through the scoped writeback transport and records them in the ledger.
//
//   npm run clay:import -- <export.csv> [--live] [--date YYYY-MM-DD]
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { AttioWritebackClient, runWriteback } from "../packages/connectors/src/attio/writeback.ts";
import { attioWritebackConfigFromEnv, WritebackTransport } from "../packages/connectors/src/attio/writeback-transport.ts";
import { loadAttioPeopleAndCompanies } from "../packages/db/src/attio-mirror.ts";
import { PostgresAttioWriteback } from "../packages/db/src/attio-writeback.ts";
import { closePool } from "../packages/db/src/client.ts";
import { expandClayTable, mapClayRows, toWritebackRecord, type RoleSlot } from "./clay-attio-mapping.ts";
import { parseCsv } from "./georgia-sample/clay-reduce.ts";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch {
  // The variables may already be in the environment.
}

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { live: { type: "boolean", default: false }, date: { type: "string" } },
});
const file = positionals[0];
const enrichedOn = args.date ?? new Date().toISOString().slice(0, 10);
if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(enrichedOn)) {
  console.error("Usage: npm run clay:import -- <clay-export.csv> [--live] [--date YYYY-MM-DD]");
  process.exit(1);
}
const config = attioWritebackConfigFromEnv();
if (!config) {
  console.error("Attio writeback is not configured. Set ATTIO_WRITEBACK_TOKEN, ATTIO_CONNECTION_ID, and ATTIO_WRITEBACK_SLUGS as in .env.example.");
  process.exit(1);
}

const roleMap = JSON.parse(
  await readFile(resolve(import.meta.dirname, "..", "data", "georgia-sample", "clay-role-map.json"), "utf8"),
) as { roleSlots: RoleSlot[] };

try {
  const rows = expandClayTable(parseCsv(await readFile(resolve(file), "utf8")), roleMap.roleSlots.map((slot) => slot.id));
  const mapped = mapClayRows(rows, { roleSlots: roleMap.roleSlots, enrichedOn });
  const mirror = await loadAttioPeopleAndCompanies(config.connectionId);
  const state = {
    companies: mirror.companies.map((payload) => toWritebackRecord(payload, config.slugs)),
    people: mirror.people.map((payload) => toWritebackRecord(payload, config.slugs)),
  };
  const report = await runWriteback({
    connectionId: config.connectionId,
    state,
    companies: mapped.companies,
    people: mapped.people,
    store: new PostgresAttioWriteback(),
    dryRun: !args.live,
    ...(args.live ? { client: new AttioWritebackClient(new WritebackTransport({ accessToken: config.accessToken, slugs: config.slugs })) } : {}),
  });

  const count = (kind: string, objectType: string) =>
    report.plan.operations.filter((operation) => operation.kind === kind && operation.objectType === objectType).length;
  const reasons = new Map<string, number>();
  for (const item of report.plan.reviews) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
  const skips = new Map<string, number>();
  for (const item of mapped.skipped) skips.set(item.reason, (skips.get(item.reason) ?? 0) + 1);

  console.log(
    [
      `${report.dryRun ? "Dry run" : "Live run"}: ${mapped.companies.length} company and ${mapped.people.length} person enrichments from ${resolve(file)}.`,
      `Planned: ${count("create", "people")} people created, ${count("update", "people")} people updated, ${count("update", "companies")} companies updated.`,
      `Review items: ${report.plan.reviews.length}${[...reasons].map(([reason, n]) => `, ${reason} ${n}`).join("")}.`,
      ...(mapped.skipped.length ? [`Rows skipped before planning: ${mapped.skipped.length}${[...skips].map(([reason, n]) => `; ${reason} ${n}`).join("")}.`] : []),
      report.dryRun
        ? "Nothing was written. Pass --live to write to Attio and queue the review items."
        : `Written: ${report.created} created, ${report.updated} updated; ${report.reviewsQueued} review items queued, ${report.reviewsAlreadyQueued} already queued.`,
    ].join("\n"),
  );
} finally {
  await closePool();
}
