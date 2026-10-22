// Exit-gate rehearsal against PostgreSQL using the synthetic recorded Attio
// responses: sync, resync, then a changed run, asserting idempotence and that only
// reads reached the API, then the audit mapping over the mirrored snapshot.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { recordedAttio } from "../packages/connectors/src/attio/connect.ts";
import { objectSpecs } from "../packages/connectors/src/attio/objects.ts";
import { changeCount, syncObjects, type SyncBounds } from "../packages/connectors/src/attio/sync.ts";
import { attioSnapshotChecksum } from "../packages/core/src/attio-mapping.ts";
import { closePool } from "../packages/db/src/client.ts";
import { migrate } from "../packages/db/src/migrate.ts";
import {
  countAttioRecords,
  loadAttioSnapshot,
  PostgresAttioMirror,
  resetAttioConnection,
} from "../packages/db/src/attio-mirror.ts";

const fixtures = resolve(import.meta.dirname, "..", "fixtures", "connectors", "attio-recorded-v1");
const connectionId = "attio-recorded-synthetic-v1";
const bounds: SyncBounds = { connectionId, pageSize: 5, maxPagesPerObject: 10 };

try {
  await migrate();
  await resetAttioConnection(connectionId);
  const store = new PostgresAttioMirror();
  const specs = objectSpecs();

  const initial = recordedAttio(resolve(fixtures, "initial"));
  const first = await syncObjects(initial.client, store, specs, bounds);
  assert.equal(changeCount(first), 44, "First sync inserts every synthetic record.");

  const replay = recordedAttio(resolve(fixtures, "initial"));
  const resync = await syncObjects(replay.client, store, specs, bounds);
  assert.equal(changeCount(resync), 0, "Resyncing the same responses changes nothing.");

  const changed = recordedAttio(resolve(fixtures, "changed"));
  const next = await syncObjects(changed.client, store, specs, bounds);
  const companies = next.find((report) => report.objectType === "companies");
  assert.deepEqual([companies?.updated, companies?.unchanged, changeCount(next)], [1, 7, 1]);

  const requests = [...initial.requests, ...replay.requests, ...changed.requests];
  assert.ok(
    requests.every((request) => request.method === "GET" || /\/records\/query$/.test(new URL(request.url).pathname)),
    "Only reads and record queries reached Attio.",
  );

  const objectKeys = Object.fromEntries(specs.map((spec) => [spec.objectType, spec.key]));
  const snapshot = await loadAttioSnapshot(connectionId, objectKeys, "synthetic-test-fixture", connectionId);
  const again = await loadAttioSnapshot(connectionId, objectKeys, "synthetic-test-fixture", connectionId);
  const mirrored = Object.values(await countAttioRecords(connectionId)).reduce((total, count) => total + count, 0);
  assert.equal(Object.values(snapshot.records).reduce((total, list) => total + (list?.length ?? 0), 0), mirrored);
  assert.equal(attioSnapshotChecksum(snapshot), attioSnapshotChecksum(again), "Snapshot reads are stable.");

  console.log(
    `Attio recorded verification passed: ${requests.length} read requests, mirror counts ${JSON.stringify(
      await countAttioRecords(connectionId),
    )}, resync changes 0, snapshot sha256 ${attioSnapshotChecksum(snapshot).slice(0, 12)}.`,
  );
} finally {
  await closePool();
}
