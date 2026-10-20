// Live bounded sync into the local mirror. Refuses to run until the Developer
// Edition org's read-only integration user is configured through environment
// variables; see docs/milestones/milestone-3-salesforce-connector-notes.md.
import { salesforceConfigFromEnv } from "../packages/connectors/src/salesforce/config.ts";
import { connectSalesforce } from "../packages/connectors/src/salesforce/connect.ts";
import { objectSpecs } from "../packages/connectors/src/salesforce/objects.ts";
import { syncObjects } from "../packages/connectors/src/salesforce/sync.ts";
import { closePool } from "../packages/db/src/client.ts";
import { PostgresSalesforceMirror } from "../packages/db/src/salesforce-mirror.ts";

const config = salesforceConfigFromEnv();
if (!config) {
  console.error("Salesforce is not configured. Set SALESFORCE_AUTH_FLOW and the related variables in .env.example.");
  process.exit(1);
}

const initialSince = process.env.SALESFORCE_INITIAL_SINCE;
if (!initialSince || Number.isNaN(Date.parse(initialSince))) {
  console.error("SALESFORCE_INITIAL_SINCE must be an ISO date that bounds the first sync.");
  process.exit(1);
}

try {
  const client = await connectSalesforce(config);
  const reports = await syncObjects(client, new PostgresSalesforceMirror(), objectSpecs({
    siteObjectApiName: config.siteObjectApiName,
  }), {
    connectionId: config.connectionId,
    initialSince: new Date(initialSince),
    // Two minutes of settle time for records committed with an earlier SystemModstamp.
    until: new Date(Date.now() - 120_000),
    maxRecordsPerObject: Number(process.env.SALESFORCE_MAX_RECORDS_PER_OBJECT ?? 2000),
    maxPagesPerObject: 20,
  });
  for (const report of reports) {
    console.log(
      `${report.objectType}: seen ${report.seen}, inserted ${report.inserted}, updated ${report.updated}, unchanged ${report.unchanged}, stale ${report.stale}${report.truncated ? " (truncated)" : ""}`,
    );
  }
} finally {
  await closePool();
}
