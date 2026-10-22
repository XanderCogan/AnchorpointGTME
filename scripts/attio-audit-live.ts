// Milestone 3 exit-gate check: runs the audit mapping over the live mirrored Attio snapshot
// and reports mapping gaps and finding counts. Reads only the local mirror; never calls Attio.
import { readFileSync } from "node:fs";
import { auditCrm } from "../packages/core/src/audit.ts";
import { attioSnapshotChecksum, mapAttioToAuditRelease } from "../packages/core/src/attio-mapping.ts";
import { attioConfigFromEnv } from "../packages/connectors/src/attio/config.ts";
import { objectSpecs } from "../packages/connectors/src/attio/objects.ts";
import { closePool } from "../packages/db/src/client.ts";
import { loadAttioSnapshot } from "../packages/db/src/attio-mirror.ts";

const config = attioConfigFromEnv();
if (!config) {
  console.error("Attio is not configured. Set ATTIO_ACCESS_TOKEN and ATTIO_CONNECTION_ID as in .env.example.");
  process.exit(1);
}
// The fixture mapping carries the approved option titles; the release name marks this as the live mirror.
const fixtureMapping = JSON.parse(readFileSync("fixtures/releases/attio-mapping-v1/input/attio.json", "utf8")).mapping;
const mapping = { ...fixtureMapping, release: "attio-live", servicedRegions: ["GA"] };

try {
  const specs = objectSpecs({ site: config.siteObjectSlug, call: config.callObjectSlug });
  const objectKeys = Object.fromEntries(specs.map((spec) => [spec.objectType, spec.key]));
  const snapshot = await loadAttioSnapshot(config.connectionId, objectKeys, "client-mirror", config.connectionId);
  const { release, gaps } = mapAttioToAuditRelease(snapshot, mapping);
  const findings = auditCrm(release);
  const counts = Object.fromEntries(Object.entries(snapshot.records).map(([key, list]) => [key, list?.length ?? 0]));
  console.log(`snapshot sha256 ${attioSnapshotChecksum(snapshot).slice(0, 12)}`, JSON.stringify(counts));
  console.log(`gaps: ${gaps.length}`);
  for (const gap of gaps) console.log(`  ${gap.object}.${gap.field}: ${gap.recordsMissingField} records missing`);
  const byRule = new Map<string, number>();
  for (const finding of findings) byRule.set(`${finding.severity} ${finding.ruleId}`, (byRule.get(`${finding.severity} ${finding.ruleId}`) ?? 0) + 1);
  console.log(`findings: ${findings.length}`);
  for (const [rule, count] of [...byRule].sort()) console.log(`  ${rule}: ${count}`);
} finally {
  await closePool();
}
