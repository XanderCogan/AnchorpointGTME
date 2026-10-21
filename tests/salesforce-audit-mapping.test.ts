import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { auditCrm } from "../packages/core/src/audit.ts";
import {
  mapSalesforceToAuditRelease,
  salesforceInstant,
  type SalesforceAuditMapping,
  type SalesforceSnapshot,
} from "../packages/core/src/salesforce-mapping.ts";
import type { FindingExpectation } from "../packages/core/src/types.ts";

const projectRoot = resolve(import.meta.dirname, "..");

interface MappingFixture {
  synthetic: true;
  mapping: SalesforceAuditMapping;
  snapshot: SalesforceSnapshot;
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(projectRoot, path), "utf8")) as T;
}

const loadFixture = () => loadJson<MappingFixture>("fixtures/releases/salesforce-mapping-v1/input/salesforce.json");

test("salesforce-mapping-v1 reproduces every inspection-v1 rule through the Salesforce mapping", async () => {
  const fixture = await loadFixture();
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.snapshot.provenance, "synthetic-test-fixture");
  const expected = await loadJson<FindingExpectation[]>("fixtures/releases/salesforce-mapping-v1/expected/findings.json");
  const inspection = await loadJson<FindingExpectation[]>("fixtures/releases/inspection-v1/expected/findings.json");

  const { release, gaps } = mapSalesforceToAuditRelease(fixture.snapshot, fixture.mapping);
  const actual = auditCrm(release).map(({ ruleId, severity, objectType, affectedIds }) => ({
    ruleId,
    severity,
    objectType,
    affectedIds,
  }));

  assert.deepEqual(gaps, []);
  assert.deepEqual(actual, expected);
  assert.deepEqual(
    [...new Set(actual.map((finding) => finding.ruleId))].sort(),
    [...new Set(inspection.map((finding) => finding.ruleId))].sort(),
  );
  assert.equal(actual.filter((finding) => finding.severity === "critical").length, 15);
  assert.equal(actual.filter((finding) => finding.severity === "warning").length, 6);
});

test("Salesforce mapping never promotes a missing status or owner to a usable one", async () => {
  const fixture = await loadFixture();
  const contact = { ...fixture.snapshot.records.contact![0]! };
  delete contact.Email_Status__c;
  delete contact.Phone_Status__c;
  const account = { ...fixture.snapshot.records.account![0]!, OwnerId: "005MAP000000099AAA" };
  const snapshot: SalesforceSnapshot = {
    ...fixture.snapshot,
    records: { ...fixture.snapshot.records, contact: [contact], account: [account] },
  };

  const { release, gaps } = mapSalesforceToAuditRelease(snapshot, fixture.mapping);

  assert.equal(release.contacts[0]!.emailStatus, "unverified");
  assert.equal(release.contacts[0]!.phoneStatus, "unverified");
  assert.equal(release.companies[0]!.ownerId, null, "an owner who is not a known active user is no owner");
  assert.deepEqual(
    gaps.filter((gap) => gap.object === "contact").map((gap) => gap.field),
    ["Email_Status__c", "Phone_Status__c"],
  );
});

test("Sites count as locations of their Account, never as Accounts", async () => {
  const fixture = await loadFixture();
  const { release } = mapSalesforceToAuditRelease(fixture.snapshot, fixture.mapping);

  assert.equal(release.companies.length, fixture.snapshot.records.account!.length);
  assert.equal(release.companies.find((company) => company.name === "Clean Fixture Operator")!.locationCount, 2);
});

test("Salesforce timestamps normalize to ISO-8601 UTC", () => {
  assert.equal(salesforceInstant("2026-04-02T18:45:10.000+0000"), "2026-04-02T18:45:10.000Z");
  assert.equal(salesforceInstant("2026-04-02T18:45:10.000-0500"), "2026-04-02T23:45:10.000Z");
  assert.equal(salesforceInstant("2026-10-24"), "2026-10-24T00:00:00.000Z");
  assert.equal(salesforceInstant(null), null);
  assert.equal(salesforceInstant("not a date"), null);
});
