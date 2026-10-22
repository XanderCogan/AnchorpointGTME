import assert from "node:assert/strict";
import test from "node:test";
import type { AttioRecord } from "../packages/connectors/src/attio/client.ts";
import type { FetchLike } from "../packages/connectors/src/attio/transport.ts";
import {
  AttioWritebackClient,
  InMemoryWritebackStore,
  runWriteback,
  type CompanyEnrichment,
  type PersonEnrichment,
} from "../packages/connectors/src/attio/writeback.ts";
import {
  assertWritebackRequest,
  attioWritebackConfigFromEnv,
  WritebackScopeError,
  WritebackTransport,
} from "../packages/connectors/src/attio/writeback-transport.ts";

// Synthetic only: an in-memory stand-in for Attio, fictional example.com people, and
// no network. The fake converts write values into Attio's read shapes so a rerun
// plans against what the previous run wrote.

const base = "https://api.attio.com";
const connectionId = "test-synthetic";
const at = "2026-10-01T00:00:00.000Z";

type Entry = Record<string, unknown>;

function record(objectId: string, recordId: string, values: Record<string, Entry[]>): AttioRecord {
  return { id: { workspace_id: "ws", object_id: objectId, record_id: recordId }, created_at: at, values };
}

const human = { active_from: at, created_by_actor: { type: "workspace-member", id: "member-1" } };

function readShape(attribute: string, value: unknown): Entry[] {
  const stamp = { active_from: "2026-10-22T00:00:00.000Z", created_by_actor: { type: "api-token", id: "writeback" } };
  switch (attribute) {
    case "domains":
      return (value as string[]).map((domain) => ({ ...stamp, domain, root_domain: domain }));
    case "email_addresses":
      return (value as string[]).map((email_address) => ({ ...stamp, email_address }));
    case "name":
    case "company":
      return (value as Entry[]).map((entry) => ({ ...stamp, ...entry }));
    case "primary_location":
      return [{ ...stamp, ...(value as Entry) }];
    case "persona":
      return [{ ...stamp, option: { title: value } }];
    default:
      return [{ ...stamp, value }];
  }
}

class FakeAttio {
  readonly companies = new Map<string, AttioRecord>();
  readonly people = new Map<string, AttioRecord>();
  readonly requests: { method: string; path: string; body: unknown }[] = [];
  #next = 1;

  constructor(companies: AttioRecord[], people: AttioRecord[]) {
    for (const company of companies) this.companies.set(company.id.record_id, structuredClone(company));
    for (const person of people) this.people.set(person.id.record_id, structuredClone(person));
  }

  state() {
    return { companies: structuredClone([...this.companies.values()]), people: structuredClone([...this.people.values()]) };
  }

  fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = JSON.parse(String(init?.body)) as { data: { values: Record<string, unknown> } };
    this.requests.push({ method, path: url.pathname, body });
    const values = body.data.values;
    let target: AttioRecord;
    if (method === "POST") {
      target = record("people", `person-new-${this.#next++}`, {});
      this.people.set(target.id.record_id, target);
    } else {
      const [, , , objectType, , recordId] = url.pathname.split("/");
      const found = (objectType === "people" ? this.people : this.companies).get(recordId!);
      if (!found) return new Response("{}", { status: 404 });
      target = found;
    }
    for (const [attribute, value] of Object.entries(values)) {
      const shaped = readShape(attribute, value);
      // PATCH appends to multi-valued attributes, as Attio does.
      target.values[attribute] = ["domains", "email_addresses"].includes(attribute) ? [...(target.values[attribute] ?? []), ...shaped] : shaped;
    }
    return new Response(JSON.stringify({ data: target }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

const companies = [
  record("companies", "company-a", { name: [{ ...human, value: "Example Care Group" }] }),
  record("companies", "company-b", { name: [{ ...human, value: "Sample Senior Living" }], domains: [{ ...human, domain: "human-entered.example.com" }] }),
];
const existingPeople = [
  record("people", "person-ada", {
    name: [{ ...human, first_name: "Ada", last_name: "Example", full_name: "Ada Example" }],
    company: [{ ...human, target_object: "companies", target_record_id: "company-a" }],
    job_title: [{ ...human, value: "Administrator" }],
  }),
  record("people", "person-ben", {
    name: [{ ...human, first_name: "Ben", last_name: "Sample", full_name: "Ben Sample" }],
    email_addresses: [{ ...human, email_address: "ben.sample@example.com" }],
    company: [{ ...human, target_object: "companies", target_record_id: "company-b" }],
  }),
];

const companyRows: CompanyEnrichment[] = [
  {
    sourceKey: "clay-company-a",
    companyRecordId: "company-a",
    domain: "https://www.care.example.com/",
    primaryLocation: { line1: "1 Example Way", locality: "Atlanta", region: "GA", postcode: "30301", countryCode: "US" },
  },
  { sourceKey: "clay-company-b", companyRecordId: "company-b", domain: "clay-found.example.com" },
];

const person = (overrides: Partial<PersonEnrichment>): PersonEnrichment => ({
  sourceKey: "clay-person-1",
  companyRecordId: "company-a",
  match: "confirmed",
  firstName: "Cora",
  lastName: "Example",
  jobTitle: "Executive Director",
  workEmail: "cora.example@example.com",
  linkedinUrl: "https://www.linkedin.com/in/cora-example-fictional",
  persona: "Site Administrator",
  personaVerified: true,
  source: "clay",
  enrichedOn: "2026-10-22",
  ...overrides,
});

function harness(people = existingPeople) {
  const attio = new FakeAttio(companies, people);
  const store = new InMemoryWritebackStore();
  const client = new AttioWritebackClient(new WritebackTransport({ accessToken: "test-writeback", fetch: attio.fetch }));
  const run = (rows: { companies?: CompanyEnrichment[]; people?: PersonEnrichment[] }, dryRun = false) =>
    runWriteback({ connectionId, state: attio.state(), companies: rows.companies ?? [], people: rows.people ?? [], store, client, dryRun });
  return { attio, store, run };
}

test("the writeback transport refuses everything outside its scope before the network", async () => {
  let calls = 0;
  const transport = new WritebackTransport({ accessToken: "test", fetch: async () => { calls += 1; return new Response("{}"); } });
  const link = [{ target_object: "companies", target_record_id: "company-a" }];
  const name = [{ first_name: "Cora", last_name: "Example", full_name: "Cora Example" }];
  const refused = [
    { method: "GET", url: "/v2/objects/people/records/person-ada" },
    { method: "DELETE", url: "/v2/objects/people/records/person-ada" },
    { method: "PUT", url: "/v2/objects/people/records?matching_attribute=email_addresses", body: { data: { values: { name, company: link } } } },
    { method: "PUT", url: "/v2/objects/companies/records/company-a", body: { data: { values: { domains: ["x.example.com"] } } } },
    { method: "POST", url: "/v2/objects/companies/records", body: { data: { values: { name: "New Co" } } } },
    { method: "POST", url: "/v2/objects/deals/records", body: { data: { values: { name: "Deal" } } } },
    { method: "POST", url: "/v2/tasks", body: { data: { content: "x" } } },
    { method: "POST", url: "/v2/objects/people/records", body: { data: { values: { name } } } },
    { method: "POST", url: "/v2/objects/people/records", body: { data: { values: { company: link } } } },
    { method: "POST", url: "/v2/objects/people/records", body: { data: { values: { name, company: link, owner: "member-1" } } } },
    { method: "PATCH", url: "/v2/objects/people/records/person-ada", body: { data: { values: { owner: "member-1" } } } },
    { method: "PATCH", url: "/v2/objects/people/records/person-ada", body: { data: { values: { company: link } } } },
    { method: "PATCH", url: "/v2/objects/people/records/person-ada", body: { data: { values: { lifecycle_stage: "Customer" } } } },
    { method: "PATCH", url: "/v2/objects/companies/records/company-a", body: { data: { values: { customer_status: "Customer" } } } },
    { method: "PATCH", url: "/v2/objects/companies/records/company-a", body: { data: { values: { job_title: "x" } } } },
    { method: "PATCH", url: "/v2/objects/companies/records/company-a", body: { data: { values: {} } } },
    { method: "PATCH", url: "/v2/objects/companies/records/company-a", body: { data: { values: { domains: ["x"] }, extra: 1 } } },
    { method: "PATCH", url: "/v2/objects/companies/records/company-a?x=1", body: { data: { values: { domains: ["x"] } } } },
    { method: "PATCH", url: "/v2/objects/deals/records/deal-1", body: { data: { values: { name: "x" } } } },
    { method: "PATCH", url: "https://evil.example/v2/objects/companies/records/company-a", body: { data: { values: { domains: ["x"] } } } },
  ];
  for (const request of refused) {
    await assert.rejects(transport.send(request), WritebackScopeError, `${request.method} ${request.url}`);
  }
  assert.equal(calls, 0);
  assert.doesNotThrow(() =>
    assertWritebackRequest({ method: "post", url: "/v2/objects/people/records", body: { data: { values: { name, company: link, job_title: "x" } } } }, base),
  );
  assert.doesNotThrow(() =>
    assertWritebackRequest({ method: "PATCH", url: "/v2/objects/companies/records/company-a", body: { data: { values: { primary_location: {} } } } }, base),
  );
});

test("writeback configuration needs its own token and a connection ID", () => {
  assert.equal(attioWritebackConfigFromEnv({ ATTIO_ACCESS_TOKEN: "read" }), null);
  assert.throws(() => attioWritebackConfigFromEnv({ ATTIO_WRITEBACK_TOKEN: "w" }), /ATTIO_CONNECTION_ID/);
  assert.throws(
    () => attioWritebackConfigFromEnv({ ATTIO_WRITEBACK_TOKEN: "same", ATTIO_ACCESS_TOKEN: "same", ATTIO_CONNECTION_ID: "c" }),
    /must differ/,
  );
  assert.deepEqual(attioWritebackConfigFromEnv({ ATTIO_WRITEBACK_TOKEN: "w", ATTIO_CONNECTION_ID: "c" }), { connectionId: "c", accessToken: "w" });
});

test("empty fields are filled and a new person is created under its company", async () => {
  const { attio, run } = harness();
  const report = await run({ companies: [companyRows[0]!], people: [person({})] });
  assert.deepEqual([report.created, report.updated, report.reviewsQueued], [1, 1, 0]);
  const company = attio.companies.get("company-a")!;
  assert.equal(company.values.domains?.[0]?.domain, "care.example.com");
  assert.equal(company.values.primary_location?.[0]?.locality, "Atlanta");
  const created = [...attio.people.values()].find((record) => record.id.record_id.startsWith("person-new"))!;
  assert.equal(created.values.company?.[0]?.target_record_id, "company-a");
  assert.equal(created.values.persona?.[0]?.option && (created.values.persona[0].option as Entry).title, "Site Administrator");
  assert.equal(created.values.persona_verified?.[0]?.value, true);
  assert.equal(created.values.enrichment_source?.[0]?.value, "clay");
  assert.equal(created.values.enrichment_date?.[0]?.value, "2026-10-22");
});

test("an existing person gets only empty fields; a differing human value goes to review", async () => {
  const { attio, store, run } = harness();
  const report = await run({ people: [person({ personRecordId: "person-ada", firstName: "Ada", lastName: "Example", workEmail: "ada.example@example.com" })] });
  assert.equal(report.updated, 1);
  const ada = attio.people.get("person-ada")!;
  assert.equal(ada.values.job_title?.[0]?.value, "Administrator", "the human job title is kept");
  assert.equal(ada.values.email_addresses?.[0]?.email_address, "ada.example@example.com");
  const [review] = [...store.reviews.values()];
  assert.deepEqual([review?.reason, review?.attribute, review?.currentValue, review?.proposedValue], ["conflict", "job_title", "administrator", "Executive Director"]);
  const patch = attio.requests.find((request) => request.method === "PATCH");
  assert.ok(!("job_title" in (patch?.body as { data: { values: Entry } }).data.values));
});

test("a company domain a human entered is not overwritten", async () => {
  const { attio, store, run } = harness();
  const report = await run({ companies: [companyRows[1]!] });
  assert.equal(report.updated, 0);
  assert.equal(attio.requests.length, 0);
  assert.deepEqual([...store.reviews.values()].map((item) => [item.reason, item.attribute, item.currentValue]), [
    ["conflict", "domains", "human-entered.example.com"],
  ]);
});

test("a value this writeback wrote earlier may be refreshed, a human value may not", async () => {
  const { attio, run } = harness();
  await run({ people: [person({})] });
  const refreshed = await run({ people: [person({ jobTitle: "Regional Director", enrichedOn: "2026-11-01" })] });
  assert.deepEqual([refreshed.updated, refreshed.reviewsQueued], [1, 0]);
  const created = [...attio.people.values()].find((record) => record.id.record_id.startsWith("person-new"))!;
  assert.equal(created.values.job_title?.[0]?.value, "Regional Director");
  assert.equal(created.values.enrichment_date?.[0]?.value, "2026-11-01");
});

test("possible duplicates go to review and nothing is created", async () => {
  const { attio, store, run } = harness();
  const report = await run({
    people: [
      person({ sourceKey: "dup-email", companyRecordId: "company-a", firstName: "Benjamin", lastName: "Sample", workEmail: "Ben.Sample@example.com" }),
      person({ sourceKey: "dup-name", companyRecordId: "company-a", firstName: "ada", lastName: "EXAMPLE", workEmail: "a.example@example.com" }),
    ],
  });
  assert.equal(report.created, 0);
  assert.equal(attio.requests.length, 0);
  assert.deepEqual([...store.reviews.values()].map((item) => [item.sourceKey, item.reason, item.currentValue]), [
    ["dup-email", "possible_duplicate", "person-ben"],
    ["dup-name", "possible_duplicate", "person-ada"],
  ]);
});

test("an uncertain identity match or an unknown company goes to review without a write", async () => {
  const { attio, store, run } = harness();
  await run({
    people: [
      person({ sourceKey: "uncertain", match: "uncertain" }),
      person({ sourceKey: "no-company", companyRecordId: "company-missing" }),
      person({ sourceKey: "wrong-company", personRecordId: "person-ben", companyRecordId: "company-a", firstName: "Ben", lastName: "Sample" }),
    ],
  });
  assert.equal(attio.requests.length, 0);
  assert.deepEqual([...store.reviews.values()].map((item) => [item.sourceKey, item.reason]), [
    ["uncertain", "uncertain_match"],
    ["no-company", "company_not_found"],
    ["wrong-company", "uncertain_match"],
  ]);
});

test("an unverified persona goes to review and is not written", async () => {
  const { attio, store, run } = harness();
  const report = await run({ people: [person({ personaVerified: false })] });
  assert.equal(report.created, 1);
  const values = (attio.requests[0]?.body as { data: { values: Entry } }).data.values;
  assert.ok(!("persona" in values) && !("persona_verified" in values));
  assert.deepEqual([...store.reviews.values()].map((item) => [item.reason, item.attribute, item.proposedValue]), [
    ["persona_unverified", "persona", "Site Administrator"],
  ]);
});

test("rerunning the same input changes nothing and queues nothing new", async () => {
  const { attio, store, run } = harness();
  const rows = {
    companies: companyRows,
    people: [person({}), person({ sourceKey: "p2", personRecordId: "person-ada", firstName: "Ada", lastName: "Example", workEmail: "ada.example@example.com", personaVerified: false })],
  };
  const first = await run(rows);
  assert.ok(first.created + first.updated > 0);
  const requests = attio.requests.length;
  const reviews = store.reviews.size;
  const second = await run(rows);
  assert.deepEqual([second.created, second.updated, second.reviewsQueued, second.plan.operations.length], [0, 0, 0, 0]);
  assert.equal(second.reviewsAlreadyQueued, reviews);
  assert.equal(attio.requests.length, requests);
  assert.equal(store.reviews.size, reviews);
});

test("a dry run plans writes and reviews without calling the transport or the store", async () => {
  const { attio, store, run } = harness();
  const report = await run({ companies: companyRows, people: [person({}), person({ sourceKey: "u", match: "uncertain" })] }, true);
  assert.equal(report.dryRun, true);
  assert.deepEqual(report.plan.operations.map((operation) => [operation.kind, operation.objectType]), [
    ["update", "companies"],
    ["create", "people"],
  ]);
  assert.deepEqual(report.plan.reviews.map((item) => item.reason).sort(), ["conflict", "uncertain_match"]);
  assert.deepEqual([report.created, report.updated, report.reviewsQueued], [0, 0, 0]);
  assert.equal(attio.requests.length, 0);
  assert.equal(store.reviews.size + store.written.size + store.created.size, 0);
  // A dry run needs no client at all.
  const clientless = await runWriteback({ connectionId, state: attio.state(), companies: companyRows, people: [], store, dryRun: true });
  assert.equal(clientless.plan.operations.length, 1);
});
