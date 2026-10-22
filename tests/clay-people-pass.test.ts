import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { missingReductionColumns, OPERATOR_SLOTS, parseCsv, personalDataLeaks, reduce, roleChange, validate } from "../scripts/georgia-sample/clay-reduce.ts";

const schema = JSON.parse(await readFile(resolve(import.meta.dirname, "..", "data", "georgia-sample", "people-coverage.schema.json"), "utf8"));

// A synthetic Clay export: every person-level column is fake, and none may reach the output.
const operatorsIn = parseCsv("operator_id,band\nga-op-chain-1,A\n");
const sitesIn = parseCsv("ccn,operator_id,band,wave\n115001,ga-op-chain-1,A,1\n115002,ga-op-chain-1,A,1\n115003,ga-op-lbn-solo,C,1\n");
const operatorsOut = parseCsv(
  [
    "operator_id,person_name,person_title,linkedin_url,work_email,operator_regional_facilities__searched,operator_regional_facilities__found,operator_regional_facilities__persona_verified,operator_regional_facilities__employment_verified,operator_regional_facilities__tenure_band,operator_regional_facilities__channel,operator_operations_vp__searched,operator_operations_vp__found",
    'ga-op-chain-1,"Pat Example, Jr.",Regional Director of Maintenance,https://www.linkedin.com/in/fake,pat@example.com,true,1,true,true,under_6_months,clay_email_waterfall_validated,true,0',
  ].join("\n"),
);
const sitesOut = parseCsv(
  [
    "ccn,admin_name,admin_phone,site_executive_director__searched,site_executive_director__found,site_executive_director__persona_verified,site_executive_director__employment_verified,site_executive_director__tenure_band,site_maintenance_director__searched,site_maintenance_director__found",
    "115001,Sam Sample,404-555-0100,true,1,true,true,over_24_months,true,0",
  ].join("\n"),
);
const run = { clayRunDates: ["2026-10-20"], freeDataCreditsUsed: 100, paidDataCreditsUsed: 0, actionsUsed: 40, paidUsd: 0, stoppedBecause: "free_credits_exhausted" };
const output = reduce({
  operatorsIn,
  sitesIn,
  operatorsOut,
  sitesOut,
  inScope: [
    { operatorId: "ga-op-chain-1", band: "A" },
    { operatorId: "ga-op-lbn-solo", band: "C" },
  ],
  run,
  retrievedOn: "2026-10-20",
});

test("reduced coverage matches the committed schema", () => {
  assert.deepEqual(validate(schema, output), []);
});

test("no person-level value from the Clay export reaches the output", () => {
  const serialized = JSON.stringify(output);
  for (const value of ["Pat", "Example", "Maintenance", "linkedin", "example.com", "Sam", "555", "over_24_months", "under_6_months"]) {
    assert.equal(serialized.includes(value), false, value);
  }
  assert.deepEqual(personalDataLeaks(serialized), []);
});

test("rows reduce to coverage codes and account-level role change", () => {
  const chain = output.operators.find((row) => row.operatorId === "ga-op-chain-1")!;
  assert.equal(chain.status, "covered");
  assert.deepEqual(chain.roleChange, { points: 14, reason: "verified_facilities_leader_started_recently" });
  assert.equal(output.operators.find((row) => row.operatorId === "ga-op-lbn-solo")!.status, "site_only");
  assert.deepEqual(output.sites.map((row) => row.status), ["covered", "operator_level_only", "not_reached"]);
});

test("role change ignores unverified people and never penalizes long tenure", () => {
  const read = (tenureBand: string, verified: boolean) => ({
    result: { searched: true, peopleFound: 1, personaVerified: verified, currentEmploymentVerified: verified, channel: "not_checked" },
    tenureBand,
  });
  assert.deepEqual(roleChange([{ slot: "site_maintenance_director", read: read("under_6_months", false) }]), { points: 0, reason: "unknown" });
  assert.deepEqual(roleChange([{ slot: "site_executive_director", read: read("over_24_months", true) }]), { points: 0, reason: "no_recent_start" });
  assert.deepEqual(roleChange([{ slot: "site_executive_director", read: read("6_to_12_months", true) }]), { points: 10, reason: "verified_leader_started_recently" });
});

test("the leak scan and schema reject personal data", () => {
  assert.ok(personalDataLeaks('{"x":"pat@example.com"}').length > 0);
  assert.ok(personalDataLeaks('{"x":"404-555-0100"}').length > 0);
  assert.ok(personalDataLeaks('{"x":"https://www.linkedin.com/in/fake"}').length > 0);
  const tampered = structuredClone(output) as Record<string, any>;
  tampered.operators[0].personName = "Pat Example";
  assert.ok(validate(schema, tampered).some((error) => error.includes("personName is not allowed")));
});

test("misnamed Clay reduction columns are reported, not read as unsearched", () => {
  assert.deepEqual(missingReductionColumns(operatorsOut, OPERATOR_SLOTS), []);
  const misnamed = parseCsv("operator_id,regional_facilities_searched,operator_regional_facilities__found\nga-op-chain-1,true,1\n");
  assert.deepEqual(missingReductionColumns(misnamed, OPERATOR_SLOTS), [
    "operator_regional_facilities__searched",
    "operator_operations_vp__searched",
    "operator_operations_vp__found",
  ]);
});
