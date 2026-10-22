// Live bounded sync of the Attio workspace into the local mirror. Refuses to run
// until a read-only access token is configured; see .env.example.
import { attioConfigFromEnv } from "../packages/connectors/src/attio/config.ts";
import { connectAttio } from "../packages/connectors/src/attio/connect.ts";
import { objectSpecs } from "../packages/connectors/src/attio/objects.ts";
import { syncObjects } from "../packages/connectors/src/attio/sync.ts";
import { closePool } from "../packages/db/src/client.ts";
import { PostgresAttioMirror } from "../packages/db/src/attio-mirror.ts";

const config = attioConfigFromEnv();
if (!config) {
  console.error("Attio is not configured. Set ATTIO_ACCESS_TOKEN and ATTIO_CONNECTION_ID as in .env.example.");
  process.exit(1);
}

try {
  const reports = await syncObjects(
    connectAttio(config),
    new PostgresAttioMirror(),
    objectSpecs({ site: config.siteObjectSlug, call: config.callObjectSlug }),
    {
      connectionId: config.connectionId,
      pageSize: 500,
      maxPagesPerObject: Number(process.env.ATTIO_MAX_PAGES_PER_OBJECT ?? 20),
    },
  );
  for (const report of reports) {
    console.log(
      `${report.objectType}: seen ${report.seen}, inserted ${report.inserted}, updated ${report.updated}, unchanged ${report.unchanged}, missing ${report.missing}`,
    );
  }
} finally {
  await closePool();
}
