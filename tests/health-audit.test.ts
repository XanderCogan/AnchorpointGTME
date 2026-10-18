import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { auditCrm } from "../packages/core/src/audit.ts";
import type { FindingExpectation, FixtureRelease } from "../packages/core/src/types.ts";

const projectRoot = resolve(import.meta.dirname, "..");

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(projectRoot, path), "utf8")) as T;
}

function expectationView(findings: ReturnType<typeof auditCrm>): FindingExpectation[] {
  return findings.map(({ ruleId, severity, objectType, affectedIds }) => ({
    ruleId,
    severity,
    objectType,
    affectedIds,
  }));
}

test("inspection-v1 matches independently authored expected findings", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const expected = await loadJson<FindingExpectation[]>("fixtures/releases/inspection-v1/expected/findings.json");
  const actual = expectationView(auditCrm(release));

  assert.deepEqual(actual, expected);
});

test("inspection-v1 matches independent control totals", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const expected = await loadJson<{
    sourceRows: Record<string, number>;
    findingCount: number;
    severityCounts: Record<string, number>;
  }>("fixtures/releases/inspection-v1/expected/control-totals.json");
  const findings = auditCrm(release);

  assert.deepEqual(
    {
      owners: release.owners.length,
      companies: release.companies.length,
      contacts: release.contacts.length,
      deals: release.deals.length,
      activities: release.activities.length,
      tasks: release.tasks.length,
    },
    expected.sourceRows,
  );
  assert.equal(findings.length, expected.findingCount);

  const severityCounts = { critical: 0, warning: 0, informational: 0 };
  for (const item of findings) severityCounts[item.severity] += 1;
  assert.deepEqual(severityCounts, expected.severityCounts);
});

test("every finding carries evidence, remediation, version, and stable identity", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const findings = auditCrm(release);

  for (const item of findings) {
    assert.ok(item.findingId.startsWith(`${item.ruleId}:${item.objectType}:`));
    assert.ok(Object.keys(item.evidence).length > 0);
    assert.ok(item.proposedRemediation.length > 0);
    assert.equal(item.ruleVersion, "health-rules-v1");
    assert.equal(item.detectedAt, release.config.asOf);
  }
});

test("inspection-v1 exercises every frozen non-connector health rule", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const actualRuleIds = [...new Set(auditCrm(release).map((item) => item.ruleId))].sort();
  const expectedRuleIds = [
    "CRM-ACTIVITY-001",
    "CRM-COMPANY-001",
    "CRM-COMPANY-002",
    "CRM-CONTACT-001",
    "CRM-CONTACT-002",
    "CRM-DATA-001",
    "CRM-DATA-002",
    "CRM-DATA-003",
    "CRM-DATA-004",
    "CRM-DATA-005",
    "CRM-DATA-006",
    "CRM-DEAL-001",
    "CRM-DEAL-002",
    "CRM-DEAL-003",
    "CRM-LIFECYCLE-001",
    "CRM-OWNER-001",
    "CRM-OWNER-002",
    "CRM-SUPPRESSION-001",
    "CRM-SUPPRESSION-002",
    "CRM-SUPPRESSION-003",
    "CRM-SUPPRESSION-004",
  ];

  assert.deepEqual(actualRuleIds, expectedRuleIds);
});

test("time boundaries and future tasks prevent false stale findings", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const findings = auditCrm(release);
  const staleIds = new Set(
    findings
      .filter((item) => item.ruleId === "CRM-DEAL-002" || item.ruleId === "CRM-DATA-004")
      .flatMap((item) => item.affectedIds),
  );

  assert.equal(staleIds.has("deal-006"), false);
  assert.equal(staleIds.has("deal-007"), false);
  assert.equal(staleIds.has("contact-015"), false);
  assert.equal(staleIds.has("deal-005"), true);
  assert.equal(staleIds.has("contact-011"), true);
});

test("the audit is deterministic and does not mutate fixture input", async () => {
  const release = await loadJson<FixtureRelease>("fixtures/releases/inspection-v1/input/hubspot.json");
  const before = structuredClone(release);

  const first = auditCrm(release);
  const second = auditCrm(release);

  assert.deepEqual(first, second);
  assert.deepEqual(release, before);
});

