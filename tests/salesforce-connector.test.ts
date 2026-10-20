import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { SalesforceTokenProvider, signJwtAssertion } from "../packages/connectors/src/salesforce/auth.ts";
import { SalesforceReadClient } from "../packages/connectors/src/salesforce/client.ts";
import { salesforceConfigFromEnv } from "../packages/connectors/src/salesforce/config.ts";
import { recordedSalesforce } from "../packages/connectors/src/salesforce/connect.ts";
import { ConcurrentSyncError, InMemoryMirrorStore } from "../packages/connectors/src/salesforce/mirror.ts";
import { objectSpecs } from "../packages/connectors/src/salesforce/objects.ts";
import { changeCount, syncObject, syncObjects, type SyncBounds } from "../packages/connectors/src/salesforce/sync.ts";
import {
  ReadOnlyTransport,
  ReadOnlyViolationError,
  type FetchLike,
} from "../packages/connectors/src/salesforce/transport.ts";

const fixtures = resolve(import.meta.dirname, "..", "fixtures", "connectors", "salesforce-recorded-v1");
const scenario = (name: "initial" | "incremental") => recordedSalesforce(resolve(fixtures, name));
const specs = objectSpecs();
const accountSpec = specs.find((spec) => spec.apiName === "Account")!;
const bounds: SyncBounds = {
  connectionId: "test-synthetic",
  initialSince: new Date("2026-01-01T00:00:00Z"),
  until: new Date("2026-10-01T00:00:00Z"),
  maxRecordsPerObject: 2000,
  maxPagesPerObject: 10,
};

async function initialSync() {
  const store = new InMemoryMirrorStore();
  const recorded = scenario("initial");
  const reports = await syncObjects(recorded.client, store, specs, bounds);
  return { store, recorded, reports };
}

test("sync follows nextRecordsUrl across pages for every object", async () => {
  const { recorded, reports, store } = await initialSync();
  const byObject = Object.fromEntries(reports.map((report) => [report.objectType, report]));
  assert.deepEqual(
    [byObject.Account?.pages, byObject.Contact?.pages, byObject.Task?.pages, byObject.User?.pages],
    [2, 2, 2, 1],
  );
  assert.equal(byObject.Account?.seen, 3);
  assert.equal(store.records.size, 17);
  assert.equal(recorded.requests.length, 11);
  assert.ok(recorded.requests.some((request) => request.url.endsWith("/query/01gSYN000000001AAA-2")));
});

test("queries are bounded by a SystemModstamp window and a record limit", async () => {
  const { recorded } = await initialSync();
  const accountQuery = recorded.requests.find((request) => request.soql?.includes("FROM Account"))?.soql;
  assert.equal(
    accountQuery,
    "SELECT Id, Name, ParentId, OwnerId, Type, Industry, BillingCity, BillingState, Website, CreatedDate, LastModifiedDate, SystemModstamp " +
      "FROM Account WHERE SystemModstamp >= 2026-01-01T00:00:00Z AND SystemModstamp <= 2026-10-01T00:00:00Z " +
      "ORDER BY SystemModstamp ASC, Id ASC LIMIT 2000",
  );
});

test("a query that exceeds its page bound fails instead of reading on", async () => {
  await assert.rejects(
    syncObject(scenario("initial").client, new InMemoryMirrorStore(), accountSpec, { ...bounds, maxPagesPerObject: 1 }),
    /1-page bound/,
  );
});

test("resyncing the same recorded pages changes nothing", async () => {
  const { store } = await initialSync();
  const writes = store.writes;
  const watermarks = new Map(store.watermarks);

  const resync = await syncObjects(scenario("initial").client, store, specs, bounds);
  assert.equal(changeCount(resync), 0);
  assert.equal(resync.reduce((total, report) => total + report.unchanged, 0), 17);
  assert.equal(store.writes, writes);
  assert.deepEqual(store.watermarks, watermarks);
});

test("an incremental window starts at the watermark and applies only real changes", async () => {
  const { store } = await initialSync();
  const incremental = scenario("incremental");
  const reports = await syncObjects(incremental.client, store, specs, {
    ...bounds,
    until: new Date("2026-10-15T00:00:00Z"),
  });
  const account = reports.find((report) => report.objectType === "Account");
  assert.deepEqual([account?.updated, account?.unchanged, changeCount(reports)], [1, 1, 1]);
  assert.match(incremental.requests[0]?.soql ?? "", /SystemModstamp >= 2026-10-01T00:00:00Z AND SystemModstamp <= 2026-10-15T00:00:00Z/);
  assert.equal(
    store.records.get("test-synthetic|Account|001SYN000000002AAA")?.payload.Name,
    "Synthetic Regional Operator North Region (fixture)",
  );
  assert.equal(await store.getWatermark("test-synthetic", "Account"), "2026-10-15T00:00:00.000Z");

  const again = await syncObjects(scenario("incremental").client, store, specs, {
    ...bounds,
    until: new Date("2026-10-15T00:00:00Z"),
  });
  assert.equal(changeCount(again), 0);
});

test("a replayed older page never overwrites a newer stored version", async () => {
  const { store } = await initialSync();
  await syncObjects(scenario("incremental").client, store, specs, { ...bounds, until: new Date("2026-10-15T00:00:00Z") });
  const replay = await syncObject(scenario("initial").client, store, accountSpec, {
    ...bounds,
    until: new Date("2026-10-20T00:00:00Z"),
  });
  assert.deepEqual([replay.stale, replay.updated, replay.inserted], [1, 0, 0]);
  assert.equal(
    store.records.get("test-synthetic|Account|001SYN000000002AAA")?.payload.Name,
    "Synthetic Regional Operator North Region (fixture)",
  );
});

test("source timestamps are preserved exactly and normalized alongside", async () => {
  const { store } = await initialSync();
  const account = store.records.get("test-synthetic|Account|001SYN000000002AAA");
  assert.ok(account);
  assert.equal(account.payload.LastModifiedDate, "2026-05-20T11:00:00.000+0000");
  assert.equal(account.payload.SystemModstamp, "2026-06-03T07:12:44.000+0000");
  assert.equal(account.payload.CreatedDate, "2026-01-12T14:05:00.000+0000");
  assert.equal(account.lastModifiedDate, "2026-05-20T11:00:00.000Z");
  assert.equal(account.systemModstamp, "2026-06-03T07:12:44.000Z");
  assert.equal(account.createdDate, "2026-01-12T14:05:00.000Z");
});

test("a batch is refused when another sync moved the watermark", async () => {
  const store = new InMemoryMirrorStore();
  store.watermarks.set("test-synthetic|Account", "2026-09-01T00:00:00.000Z");
  await assert.rejects(
    store.applyObjectSync({
      connectionId: "test-synthetic",
      objectType: "Account",
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-10-01T00:00:00.000Z",
      expectedWatermark: null,
      nextWatermark: "2026-10-01T00:00:00.000Z",
      pages: 0,
      records: [],
    }),
    ConcurrentSyncError,
  );
});

test("the transport refuses every non-GET request before reaching the network", async () => {
  let calls = 0;
  const countingFetch: FetchLike = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };
  const transport = new ReadOnlyTransport({
    instanceUrl: "https://anchorpoint-synthetic.example",
    apiVersion: "v62.0",
    accessToken: async () => "synthetic-token",
    fetch: countingFetch,
  });
  const recordUrl = "/services/data/v62.0/sobjects/Account/001SYN000000001AAA";
  for (const method of ["POST", "PATCH", "PUT", "DELETE", "post", "HEAD", "OPTIONS"]) {
    await assert.rejects(transport.send({ method, url: recordUrl }), ReadOnlyViolationError);
    await assert.rejects(
      transport.send({ method, url: "/services/data/v62.0/query?q=SELECT+Id+FROM+Account" }),
      ReadOnlyViolationError,
    );
  }
  for (const url of [
    recordUrl,
    "/services/data/v62.0/composite/sobjects",
    "/services/data/v62.0/query?q=DELETE+Account",
    "https://other-host.example/services/data/v62.0/query?q=SELECT+Id+FROM+Account",
  ]) {
    await assert.rejects(transport.send({ method: "GET", url }), ReadOnlyViolationError);
  }
  assert.equal(calls, 0);
});

test("the read client exposes no write operations", () => {
  const methods = Object.getOwnPropertyNames(SalesforceReadClient.prototype);
  assert.deepEqual(methods.sort(), ["constructor", "queryPages"]);
  assert.deepEqual(Object.getOwnPropertyNames(ReadOnlyTransport.prototype).sort(), ["constructor", "send"]);
});

test("Salesforce configuration is absent by default and rejects partial setups", () => {
  assert.equal(salesforceConfigFromEnv({}), null);
  assert.throws(
    () => salesforceConfigFromEnv({ SALESFORCE_AUTH_FLOW: "client_credentials", SALESFORCE_LOGIN_URL: "https://dev.example" }),
    /SALESFORCE_CLIENT_ID is required/,
  );
  assert.throws(() => salesforceConfigFromEnv({ SALESFORCE_AUTH_FLOW: "password" }), /client_credentials or jwt_bearer/);
});

test("JWT bearer assertions are signed with the configured key and short-lived", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = new Date("2026-10-20T12:00:00Z");
  const jwt = signJwtAssertion(
    {
      flow: "jwt_bearer",
      loginUrl: "https://login.salesforce.com",
      audience: "https://login.salesforce.com",
      clientId: "synthetic-consumer-key",
      username: "integration@anchorpoint.example",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    },
    now,
  );
  const [header, claims, signature] = jwt.split(".");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${header}.${claims}`);
  assert.equal(verifier.verify(publicKey, Buffer.from(signature!, "base64url")), true);
  assert.deepEqual(JSON.parse(Buffer.from(claims!, "base64url").toString()), {
    iss: "synthetic-consumer-key",
    sub: "integration@anchorpoint.example",
    aud: "https://login.salesforce.com",
    exp: now.getTime() / 1000 + 180,
  });
});

test("the token exchange posts only to the OAuth token endpoint", async () => {
  const seen: { url: string; method: string; body: string }[] = [];
  const tokenFetch: FetchLike = async (url, init) => {
    seen.push({ url, method: init?.method ?? "GET", body: String(init?.body) });
    return Response.json({ access_token: "synthetic", instance_url: "https://anchorpoint-synthetic.example" });
  };
  const provider = new SalesforceTokenProvider(
    {
      flow: "client_credentials",
      loginUrl: "https://anchorpoint-synthetic.example",
      clientId: "synthetic-id",
      clientSecret: "synthetic-secret",
    },
    tokenFetch,
  );
  assert.equal((await provider.session()).instanceUrl, "https://anchorpoint-synthetic.example");
  await provider.session();
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.url, "https://anchorpoint-synthetic.example/services/oauth2/token");
  assert.equal(seen[0]?.method, "POST");
  assert.match(seen[0]?.body ?? "", /grant_type=client_credentials/);
});
