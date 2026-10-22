import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { auditCrm } from "../packages/core/src/audit.ts";
import {
  attioInstant,
  mapAttioToAuditRelease,
  type AttioAuditMapping,
  type AttioSnapshot,
} from "../packages/core/src/attio-mapping.ts";
import type { FindingExpectation } from "../packages/core/src/types.ts";

const projectRoot = resolve(import.meta.dirname, "..");

interface MappingFixture {
  synthetic: true;
  mapping: AttioAuditMapping;
  snapshot: AttioSnapshot;
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(projectRoot, path), "utf8")) as T;
}

const loadFixture = () => loadJson<MappingFixture>("fixtures/releases/attio-mapping-v1/input/attio.json");

test("attio-mapping-v1 reproduces every inspection-v1 rule through the Attio mapping", async () => {
  const fixture = await loadFixture();
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.snapshot.provenance, "synthetic-test-fixture");
  const expected = await loadJson<FindingExpectation[]>("fixtures/releases/attio-mapping-v1/expected/findings.json");
  const inspection = await loadJson<FindingExpectation[]>("fixtures/releases/inspection-v1/expected/findings.json");

  const { release, gaps } = mapAttioToAuditRelease(fixture.snapshot, fixture.mapping);
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

test("Attio mapping never promotes a missing status or owner to a usable one", async () => {
  const fixture = await loadFixture();
  const person = structuredClone(fixture.snapshot.records.person![0]!);
  delete person.values.email_status;
  delete person.values.phone_status;
  const company = structuredClone(fixture.snapshot.records.company![0]!);
  company.values.owner = [
    { referenced_actor_type: "workspace-member", referenced_actor_id: "00000000-0000-4000-a000-000000000099" },
  ];
  const snapshot: AttioSnapshot = {
    ...fixture.snapshot,
    records: { ...fixture.snapshot.records, person: [person], company: [company] },
  };

  const { release, gaps } = mapAttioToAuditRelease(snapshot, fixture.mapping);

  assert.equal(release.contacts[0]!.emailStatus, "unverified");
  assert.equal(release.contacts[0]!.phoneStatus, "unverified");
  assert.equal(release.companies[0]!.ownerId, null, "an owner who is not a known active member is no owner");
  assert.deepEqual(
    gaps.filter((gap) => gap.object === "person").map((gap) => gap.field),
    ["email_status", "phone_status"],
  );
});

test("an API-key or other non-member actor never counts as an owner", async () => {
  const fixture = await loadFixture();
  const deal = structuredClone(fixture.snapshot.records.deal![0]!);
  const memberId = fixture.snapshot.records.member![0]!.id.workspace_member_id;
  deal.values.owner = [{ referenced_actor_type: "api-token", referenced_actor_id: memberId }];
  const snapshot: AttioSnapshot = { ...fixture.snapshot, records: { ...fixture.snapshot.records, deal: [deal] } };

  assert.equal(mapAttioToAuditRelease(snapshot, fixture.mapping).release.deals[0]!.ownerId, null);
});

test("Sites count as locations of their Company, never as Companies", async () => {
  const fixture = await loadFixture();
  const { release } = mapAttioToAuditRelease(fixture.snapshot, fixture.mapping);

  assert.equal(release.companies.length, fixture.snapshot.records.company!.length);
  assert.equal(release.companies.find((company) => company.name === "Clean Fixture Operator")!.locationCount, 2);
});

test("a record's last change is its latest active value, not its creation", async () => {
  const fixture = await loadFixture();
  const company = structuredClone(fixture.snapshot.records.company![0]!);
  company.values.name = [{ active_from: "2026-10-12T09:30:00.000Z", value: "Renamed" }];
  const snapshot: AttioSnapshot = { ...fixture.snapshot, records: { ...fixture.snapshot.records, company: [company] } };

  assert.equal(mapAttioToAuditRelease(snapshot, fixture.mapping).release.companies[0]!.lastModifiedAt, "2026-10-12T09:30:00.000Z");
});

test("Attio timestamps and dates normalize to ISO-8601 UTC", () => {
  assert.equal(attioInstant("2026-04-02T18:45:10.000000000Z"), "2026-04-02T18:45:10.000Z");
  assert.equal(attioInstant("2026-10-24"), "2026-10-24T00:00:00.000Z");
  assert.equal(attioInstant(null), null);
  assert.equal(attioInstant("not a date"), null);
});
