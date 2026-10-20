// Exit-gate rehearsal against PostgreSQL using the synthetic recorded responses:
// sync, resync, then an incremental window, asserting idempotence and GET-only use.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { recordedSalesforce } from "../packages/connectors/src/salesforce/connect.ts";
import { objectSpecs } from "../packages/connectors/src/salesforce/objects.ts";
import { changeCount, syncObjects, type SyncBounds } from "../packages/connectors/src/salesforce/sync.ts";
import { closePool } from "../packages/db/src/client.ts";
import { migrate } from "../packages/db/src/migrate.ts";
import {
  countSalesforceRecords,
  PostgresSalesforceMirror,
  resetSalesforceConnection,
} from "../packages/db/src/salesforce-mirror.ts";

const fixtures = resolve(import.meta.dirname, "..", "fixtures", "connectors", "salesforce-recorded-v1");
const connectionId = "recorded-synthetic-v1";
const bounds: SyncBounds = {
  connectionId,
  initialSince: new Date("2026-01-01T00:00:00Z"),
  until: new Date("2026-10-01T00:00:00Z"),
  maxRecordsPerObject: 2000,
  maxPagesPerObject: 10,
};

try {
  await migrate();
  await resetSalesforceConnection(connectionId);
  const store = new PostgresSalesforceMirror();
  const specs = objectSpecs();

  const initial = recordedSalesforce(resolve(fixtures, "initial"));
  const first = await syncObjects(initial.client, store, specs, bounds);
  assert.equal(changeCount(first), 17, "First sync inserts every synthetic record.");

  const replay = recordedSalesforce(resolve(fixtures, "initial"));
  const resync = await syncObjects(replay.client, store, specs, bounds);
  assert.equal(changeCount(resync), 0, "Resyncing the same pages changes nothing.");

  const incremental = recordedSalesforce(resolve(fixtures, "incremental"));
  const next = await syncObjects(incremental.client, store, specs, {
    ...bounds,
    until: new Date("2026-10-15T00:00:00Z"),
  });
  const account = next.find((report) => report.objectType === "Account");
  assert.deepEqual([account?.updated, account?.unchanged, changeCount(next)], [1, 1, 1]);

  const requests = [...initial.requests, ...replay.requests, ...incremental.requests];
  assert.ok(requests.every((request) => request.method === "GET"), "Only GET requests reached Salesforce.");

  console.log(
    `Salesforce recorded verification passed: ${requests.length} GET requests, mirror counts ${JSON.stringify(
      await countSalesforceRecords(connectionId),
    )}, resync changes 0.`,
  );
} finally {
  await closePool();
}
