import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { attioConfigFromEnv } from "../packages/connectors/src/attio/config.ts";
import { recordedAttio } from "../packages/connectors/src/attio/connect.ts";
import { InMemoryMirrorStore } from "../packages/connectors/src/attio/mirror.ts";
import { objectSpecs } from "../packages/connectors/src/attio/objects.ts";
import { changeCount, syncObject, syncObjects, type SyncBounds } from "../packages/connectors/src/attio/sync.ts";
import {
  assertReadOnlyRequest,
  ReadOnlyTransport,
  ReadOnlyViolationError,
  type FetchLike,
} from "../packages/connectors/src/attio/transport.ts";

const fixtures = resolve(import.meta.dirname, "..", "fixtures", "connectors", "attio-recorded-v1");
const scenario = (name: "initial" | "changed") => recordedAttio(resolve(fixtures, name));
const specs = objectSpecs();
const bounds: SyncBounds = { connectionId: "test-synthetic", pageSize: 5, maxPagesPerObject: 10 };
const base = "https://api.attio.com";

async function initialSync() {
  const store = new InMemoryMirrorStore();
  const recorded = scenario("initial");
  const reports = await syncObjects(recorded.client, store, specs, bounds);
  return { store, recorded, reports };
}

test("sync pages through every object until a short page", async () => {
  const { recorded, reports, store } = await initialSync();
  const byObject = Object.fromEntries(reports.map((report) => [report.objectType, report]));
  assert.deepEqual(
    [byObject.companies?.pages, byObject.people?.pages, byObject.calls?.pages, byObject.workspace_members?.pages],
    [2, 3, 2, 1],
  );
  // Five calls fill the first page exactly, so a second, empty page ends the read.
  assert.equal(byObject.companies?.seen, 8);
  assert.equal(byObject.people?.seen, 12);
  assert.equal(store.records.size, 3 + 8 + 8 + 12 + 7 + 5 + 1);
  assert.ok(recorded.requests.some((request) => request.body?.offset === 5));
});

test("only GET reads and record-query POSTs reach the API", async () => {
  const { recorded } = await initialSync();
  for (const request of recorded.requests) {
    const path = new URL(request.url).pathname;
    if (request.method === "POST") {
      assert.match(path, /^\/v2\/objects\/[a-z_]+\/records\/query$/);
      assert.deepEqual(Object.keys(request.body ?? {}).sort(), ["limit", "offset", "sorts"]);
    } else {
      assert.equal(request.method, "GET");
    }
  }
});

test("the transport refuses every write before the network is reached", async () => {
  let calls = 0;
  const fetchSpy: FetchLike = async () => {
    calls += 1;
    return new Response("{}");
  };
  const transport = new ReadOnlyTransport({ accessToken: "test", fetch: fetchSpy });
  const refused = [
    { method: "POST", url: "/v2/objects/companies/records", body: { data: {} } },
    { method: "PUT", url: "/v2/objects/companies/records", body: { data: {} } },
    { method: "PATCH", url: "/v2/objects/people/records/abc", body: { data: {} } },
    { method: "DELETE", url: "/v2/objects/deals/records/abc" },
    { method: "POST", url: "/v2/tasks", body: { data: {} } },
    { method: "POST", url: "/v2/objects/companies/records/query", body: { limit: 5, data: { name: "x" } } },
    { method: "POST", url: "/v2/lists/approved/entries/query", body: { limit: 5, data: { parent_record_id: "x" } } },
    { method: "POST", url: "/v2/lists/approved/entries", body: { data: {} } },
    { method: "DELETE", url: "/v2/lists/approved/entries/abc" },
    { method: "GET", url: "/v2/objects/companies/attributes" },
    { method: "GET", url: "https://evil.example/v2/tasks" },
  ];
  for (const request of refused) {
    await assert.rejects(transport.send(request), ReadOnlyViolationError, `${request.method} ${request.url}`);
  }
  assert.equal(calls, 0);
});

test("allowed reads pass the guard", () => {
  assert.doesNotThrow(() => assertReadOnlyRequest({ method: "GET", url: "/v2/tasks?limit=5&offset=0" }, base));
  assert.doesNotThrow(() => assertReadOnlyRequest({ method: "GET", url: "/v2/workspace_members" }, base));
  assert.doesNotThrow(() =>
    assertReadOnlyRequest({ method: "post", url: "/v2/objects/sites/records/query", body: { limit: 5, offset: 0 } }, base),
  );
  assert.doesNotThrow(() =>
    assertReadOnlyRequest({ method: "POST", url: "/v2/lists/approved-tier-a/entries/query", body: { limit: 5, offset: 0 } }, base),
  );
});

test("a read that exceeds its page bound fails instead of reading on", async () => {
  const companies = specs.find((spec) => spec.objectType === "companies")!;
  await assert.rejects(
    syncObject(scenario("initial").client, new InMemoryMirrorStore(), companies, { ...bounds, maxPagesPerObject: 1 }),
    /1-page bound/,
  );
});

test("resyncing the same responses changes nothing", async () => {
  const { store } = await initialSync();
  const writes = store.writes;
  const resync = await syncObjects(scenario("initial").client, store, specs, bounds);
  assert.equal(changeCount(resync), 0);
  assert.equal(resync.reduce((total, report) => total + report.unchanged, 0), store.records.size);
  assert.equal(store.writes, writes);
});

test("a later run applies only the real change", async () => {
  const { store } = await initialSync();
  const next = await syncObjects(scenario("changed").client, store, specs, bounds);
  const companies = next.find((report) => report.objectType === "companies");
  assert.deepEqual([companies?.updated, companies?.unchanged, companies?.missing, changeCount(next)], [1, 7, 0, 1]);
  const renamed = [...store.records.values()].find((record) => record.sourceChangedAt === "2026-10-10T12:00:00.000Z");
  assert.ok(renamed, "the renamed company carries its new value's active_from");
});

test("records a full read no longer returns are reported, not deleted", async () => {
  const { store } = await initialSync();
  const before = store.records.size;
  const members = specs.filter((spec) => spec.kind === "members");
  const emptyMembers: FetchLike = async () => new Response(JSON.stringify({ data: [] }));
  const client = new (await import("../packages/connectors/src/attio/client.ts")).AttioReadClient(
    new ReadOnlyTransport({ accessToken: "test", fetch: emptyMembers }),
  );
  const [report] = await syncObjects(client, store, members, bounds);
  assert.equal(report?.missing, 3);
  assert.equal(store.records.size, before);
});

test("configuration is absent until a token is set, and a token needs a connection ID", () => {
  assert.equal(attioConfigFromEnv({}), null);
  assert.throws(() => attioConfigFromEnv({ ATTIO_ACCESS_TOKEN: "x" }), /ATTIO_CONNECTION_ID/);
  assert.deepEqual(attioConfigFromEnv({ ATTIO_ACCESS_TOKEN: "x", ATTIO_CONNECTION_ID: "anchorpoint" }), {
    connectionId: "anchorpoint",
    accessToken: "x",
    siteObjectSlug: undefined,
    callObjectSlug: undefined,
  });
});
