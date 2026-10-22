import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryWritebackStore, runWriteback } from "../packages/connectors/src/attio/writeback.ts";
import { companyExportRow, expandClayTable, EXPORT_COLUMNS, mapClayRows, splitClayAddress, splitPersonName, toCsv, toWritebackRecord, type RoleSlot } from "../scripts/clay-attio-mapping.ts";
import { parseCsv } from "../scripts/georgia-sample/clay-reduce.ts";

// Synthetic only: fictional example.com companies and people, no database, no network.

const at = "2026-10-01T00:00:00.000Z";
const roleSlots: RoleSlot[] = [
  { id: "operator_regional_facilities", maxPeople: 2, titleInclude: ["regional director of maintenance"], titleExclude: ["assistant"], persona: "Regional Facilities Manager" },
];
const options = { roleSlots, enrichedOn: "2026-10-22" };

const company = (recordId: string, values: Record<string, unknown[]>) =>
  toWritebackRecord({ id: { workspace_id: "ws", object_id: "companies", record_id: recordId }, created_at: at, values }, {});

test("export row carries the Attio record ID, name, domain, and location", () => {
  const row = companyExportRow(
    company("c-1", {
      name: [{ value: "Example Care, Inc." }],
      primary_location: [{ line_1: "1 Main St", locality: "Macon", region: "GA", postcode: "31201", country_code: "US" }],
    }),
  );
  assert.equal(row.attio_company_id, "c-1");
  assert.equal(row.needs_domain, "true");
  assert.equal(row.needs_location, "false");
  const csv = toCsv([row], EXPORT_COLUMNS);
  assert.equal(parseCsv(csv)[0]!.company_name, "Example Care, Inc.");
});

test("suffixed workspace slugs are renamed to writeback names", () => {
  const record = toWritebackRecord(
    { id: { record_id: "p-1" }, created_at: at, values: { persona_verified_7: [{ value: true }], name: [] } },
    { persona_verified: "persona_verified_7" },
  );
  assert.deepEqual(Object.keys(record.values).sort(), ["name", "persona_verified"]);
});

const exportCsv = [
  "attio_company_id,company_name,domain,clay_domain,clay_locality,clay_region,clay_postcode,slot,first_name,last_name,job_title,work_email,linkedin_url,person_company_name,person_company_domain",
  "c-1,Example Care,,example.com,Macon,GA,31201,operator_regional_facilities,Pat,Sample,Regional Director of Maintenance,pat@example.com,https://www.linkedin.com/in/pat-sample-fake,Example Care LLC,example.com",
  "c-1,Example Care,,example.com,Macon,GA,31201,operator_regional_facilities,Lee,Sample,Assistant Regional Director of Maintenance,lee@example.com,,Example Care LLC,example.com",
  "c-1,Example Care,,example.com,Macon,GA,31201,operator_regional_facilities,Sam,Sample,Regional Director of Maintenance,,,Unrelated Corp,unrelated.example.net",
  "c-1,Example Care,,example.com,Macon,GA,31201,unknown_slot,Kim,Sample,Director,,,Example Care,example.com",
  "c-2,Other Example,,example.org,,,,,,,,,,,",
  "c-2,Other Example,,example.net,,,,,,,,,,,",
  ",No Id,,example.com,,,,,,,,,,,",
].join("\n");

test("Clay rows map to company and person enrichments", () => {
  const mapped = mapClayRows(parseCsv(exportCsv), options);
  assert.deepEqual(mapped.companies, [
    { sourceKey: "clay:company:c-1", companyRecordId: "c-1", domain: "example.com", primaryLocation: { line1: null, locality: "Macon", region: "GA", postcode: "31201", countryCode: "US" } },
  ]);
  const [pat, lee, sam] = mapped.people;
  assert.equal(mapped.people.length, 3);
  assert.equal(pat!.match, "confirmed");
  assert.equal(pat!.personaVerified, true);
  assert.equal(pat!.persona, "Regional Facilities Manager");
  assert.equal(pat!.workEmail, "pat@example.com");
  assert.equal(lee!.personaVerified, false, "an excluded title is not a verified persona");
  assert.equal(sam!.match, "uncertain", "a different current employer is not a confirmed match");
  assert.deepEqual(
    mapped.skipped.map((item) => item.reason),
    ['unknown slot "unknown_slot"', "conflicting clay_domain for c-2", "missing attio_company_id"],
  );
});

test("a dry run plans creates, updates, and review items without writing", async () => {
  const mapped = mapClayRows(parseCsv(exportCsv), options);
  const store = new InMemoryWritebackStore();
  const report = await runWriteback({
    connectionId: "test-synthetic",
    state: { companies: [company("c-1", { name: [{ value: "Example Care" }] })], people: [] },
    companies: mapped.companies,
    people: mapped.people,
    store,
    dryRun: true,
  });
  assert.equal(report.plan.operations.filter((op) => op.kind === "update" && op.objectType === "companies").length, 1);
  assert.equal(report.plan.operations.filter((op) => op.kind === "create").length, 2);
  assert.deepEqual(report.plan.reviews.map((item) => item.reason).sort(), ["persona_unverified", "uncertain_match"]);
  assert.equal(store.reviews.size, 0);
  assert.equal(store.written.size, 0);
});

test("a Clay table row expands into the company and one row per person from the slot JSON columns", () => {
  const people = JSON.stringify([{ name: "Pat Example, NHA, FACHE", title: "Chief Operating Officer", url: "https://www.linkedin.com/in/pat-example/", org: "Example Health" }]);
  const rows = expandClayTable(
    [{ attio_company_id: "c-1", company_name: "EXAMPLE HEALTH INC", domain: "", clay_domain: "example.com", clay_address: "1 Main Street, Tifton, GA 31794, US", operator_operations_vp_json: people, site_executive_director_json: "[]" }],
    ["operator_operations_vp", "site_executive_director"],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.clay_locality, "Tifton");
  assert.equal(rows[0]!.clay_region, "GA");
  assert.equal(rows[0]!.clay_postcode, "31794");
  assert.equal(rows[0]!.clay_line_1, "1 Main Street");
  assert.deepEqual(
    { slot: rows[1]!.slot, first: rows[1]!.first_name, last: rows[1]!.last_name, title: rows[1]!.job_title, domain: rows[1]!.domain },
    { slot: "operator_operations_vp", first: "Pat", last: "Example", title: "Chief Operating Officer", domain: "example.com" },
  );
  assert.deepEqual(splitClayAddress("Tifton, GA 31794, US"), { clay_line_1: "", clay_locality: "Tifton", clay_region: "GA", clay_postcode: "31794", clay_country_code: "US" });
  assert.deepEqual(splitClayAddress("somewhere"), {});
  assert.deepEqual(splitPersonName("Jessica Williams CPAR, ACPAR"), { firstName: "Jessica", lastName: "Williams" });
});

test("the Clay phone goes to the person with the looked-up LinkedIn URL, and a rebranded employer still matches", () => {
  const url = "https://www.linkedin.com/in/pat-example/";
  const people = JSON.stringify([
    { name: "Pat Example", title: "Chief Operating Officer", url, org: "Example Health" },
    { name: "Sam Sample", title: "Vice President of Operations", url: "https://www.linkedin.com/in/sam-sample/", org: "Example Health" },
  ]);
  const rows = expandClayTable(
    [{ attio_company_id: "c-1", company_name: "OLD LEGAL NAME INC", domain: "", clay_domain: "example.com", Name: "Example Health", "Url People": url, "Mobile Phone": "+12295550100", operator_operations_vp_json: people }],
    ["operator_operations_vp"],
  );
  assert.equal(rows[1]!.mobile_phone, "+12295550100");
  assert.equal(rows[2]!.mobile_phone, "");
  const opsSlot: RoleSlot = { id: "operator_operations_vp", maxPeople: 2, titleInclude: ["chief operating officer"], titleExclude: [], persona: "Senior-Living Operations Leader" };
  const mapped = mapClayRows(rows, { roleSlots: [opsSlot], enrichedOn: "2026-10-22" });
  assert.equal(mapped.people[0]!.mobilePhone, "+12295550100");
  assert.equal(mapped.people[0]!.match, "confirmed");
});
