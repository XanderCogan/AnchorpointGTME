import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultCrmHistoryOptions,
  runCrmHistoryAnalysis,
  snapshotChecksum,
  type CrmHistoryInput,
  type FindingDisposition,
  type Invoice,
  type MarketRecord,
} from "../packages/core/src/crm-history.ts";
import type { SalesforceAuditMapping, SalesforceSnapshot } from "../packages/core/src/salesforce-mapping.ts";

// Every run here uses the synthetic crm-history-test-v1 fixture. Its outputs prove the
// pipeline runs and are never findings (decision 0010).

const projectRoot = resolve(import.meta.dirname, "..");
const fixtureDir = "fixtures/analysis/crm-history-test-v1";

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(projectRoot, path), "utf8")) as T;
}

async function loadInput(): Promise<CrmHistoryInput> {
  const history = await loadJson<{
    synthetic: true;
    mapping: SalesforceAuditMapping;
    snapshot: SalesforceSnapshot;
    invoices: Invoice[];
    market: MarketRecord[];
  }>(`${fixtureDir}/input/history.json`);
  const { dispositions } = await loadJson<{ dispositions: Record<string, FindingDisposition> }>(
    `${fixtureDir}/input/dispositions.json`,
  );
  assert.equal(history.synthetic, true);
  return {
    snapshot: history.snapshot,
    mapping: history.mapping,
    invoices: history.invoices,
    market: history.market,
    dispositions,
    options: { ...defaultCrmHistoryOptions, asOf: history.mapping.config.asOf },
  };
}

test("crm-history-test-v1 matches control totals authored from the fixture design", async () => {
  const expected = await loadJson<{
    status: string;
    presentation: string;
    windowMonths: number;
    analysisFindingIds: string[];
    mergedAccountIds: Record<string, string>;
    parentCount: number;
    rolledUpChild: { accountId: string; parentId: string; parentSiteCount: number };
    reconciledWinCount: number;
    wonNotInvoiced: string[];
    customerFlagButChurned: string[];
    marketJoin: Record<string, number>;
    chainSize: Record<string, { won: [number, number]; retained: [number, number] }>;
    draftHypotheses: string[];
  }>(`${fixtureDir}/expected/summary.json`);
  const result = runCrmHistoryAnalysis(await loadInput());

  assert.equal(result.status, expected.status);
  assert.equal(result.presentation, expected.presentation);
  assert.match(result.label, /synthetic test fixture output, not a finding/);
  assert.equal(result.snapshot.windowMonths, expected.windowMonths);
  assert.deepEqual(result.audit.analysisFindings.map((finding) => finding.findingId), expected.analysisFindingIds);
  assert.deepEqual(result.audit.mergedAccountIds, expected.mergedAccountIds);
  assert.equal(result.parents.length, expected.parentCount);
  const rolledUp = result.parents.find((parent) => parent.parentId === expected.rolledUpChild.parentId)!;
  assert.ok(rolledUp.accountIds.includes(expected.rolledUpChild.accountId));
  assert.equal(rolledUp.siteCount, expected.rolledUpChild.parentSiteCount);
  assert.equal(result.reconciliation.reconciledWins.length, expected.reconciledWinCount);
  assert.deepEqual(result.reconciliation.wonNotInvoiced, expected.wonNotInvoiced);
  assert.deepEqual(result.reconciliation.customerFlagButChurned, expected.customerFlagButChurned);
  for (const [confidence, count] of Object.entries(expected.marketJoin)) {
    assert.equal(result.marketJoin.filter((join) => join.confidence === confidence).length, count, confidence);
  }
  const chain = result.cuts.find((cut) => cut.trait === "chain size")!;
  for (const [bucket, { won, retained }] of Object.entries(expected.chainSize)) {
    const metrics = chain.buckets.find((item) => item.bucket === bucket)!;
    assert.deepEqual([metrics.winRate.numerator, metrics.winRate.denominator], won, bucket);
    assert.deepEqual([metrics.retention.numerator, metrics.retention.denominator], retained, bucket);
  }
  assert.deepEqual(result.hypotheses.map((hypothesis) => hypothesis.statement), expected.draftHypotheses);
});

test("every rate carries its counts, thin samples are flagged, and hypotheses stay soft drafts", async () => {
  const result = runCrmHistoryAnalysis(await loadInput());

  for (const cut of result.cuts) {
    for (const bucket of cut.buckets) {
      for (const rate of [bucket.winRate, bucket.retention, bucket.expansion]) {
        assert.equal(rate.thin, rate.denominator < defaultCrmHistoryOptions.thinSampleSize);
      }
    }
  }
  assert.ok(result.questions.some((question) => question.includes("below 10 outcomes")));
  for (const hypothesis of result.hypotheses) {
    assert.equal(hypothesis.draft, true);
    assert.notEqual(hypothesis.confidence, "high" as string);
    assert.equal(hypothesis.bucketRate.thin || hypothesis.restRate.thin, false);
    assert.ok(hypothesis.caseAgainst.length >= 3);
    assert.match(hypothesis.statement, /\d+ of \d+ against \d+ of \d+/);
  }
});

test("analysis is blocked and withholds cuts until each audit finding has a disposition", async () => {
  const input = await loadInput();
  const result = runCrmHistoryAnalysis({ ...input, dispositions: {} });

  assert.equal(result.status, "blocked");
  assert.equal(result.audit.undisposed.length, 2);
  assert.deepEqual(result.cuts, []);
  assert.deepEqual(result.hypotheses, []);
  assert.deepEqual(result.questions, []);
});

test("a merge must name a survivor inside the duplicate group", async () => {
  const input = await loadInput();
  const [duplicateId] = Object.keys(input.dispositions).filter((id) => id.startsWith("CRM-COMPANY-001"));
  const result = runCrmHistoryAnalysis({
    ...input,
    dispositions: {
      ...input.dispositions,
      [duplicateId!]: { action: "merge", survivorId: "001HST000000099AAA", approvedBy: "fixture", note: "wrong survivor" },
    },
  });

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join(" "), /survivor outside the duplicate group/);
});

test("excluding a duplicate group removes its records from every outcome", async () => {
  const input = await loadInput();
  const [duplicateId] = Object.keys(input.dispositions).filter((id) => id.startsWith("CRM-COMPANY-001"));
  const result = runCrmHistoryAnalysis({
    ...input,
    dispositions: {
      ...input.dispositions,
      [duplicateId!]: { action: "exclude", approvedBy: "fixture", note: "cannot tell which is real" },
    },
  });

  assert.equal(result.status, "complete");
  assert.deepEqual(result.audit.excludedRecordIds, ["001HST000000003AAA", "001HST000000014AAA"]);
  assert.equal(result.parents.length, 24);
  assert.equal(result.reconciliation.reconciledWins.length, 14);
});

test("snapshot checksum ignores record order and attributes but not content", async () => {
  const { snapshot } = await loadInput();
  const reordered: SalesforceSnapshot = {
    ...snapshot,
    records: {
      ...snapshot.records,
      account: [...snapshot.records.account!].reverse().map((account) => ({
        ...account,
        attributes: { type: "Account", url: `/services/data/v63.0/sobjects/Account/${account.Id}` },
      })),
    },
  };
  const edited: SalesforceSnapshot = {
    ...snapshot,
    records: { ...snapshot.records, account: [{ ...snapshot.records.account![0]!, Type: "Customer - Edited" }, ...snapshot.records.account!.slice(1)] },
  };

  assert.equal(snapshotChecksum(reordered), snapshotChecksum(snapshot));
  assert.notEqual(snapshotChecksum(edited), snapshotChecksum(snapshot));
});

test("a short window warns, and only client mirrors are labelled as analysis drafts", async () => {
  const input = await loadInput();
  const short = runCrmHistoryAnalysis({
    ...input,
    snapshot: { ...input.snapshot, window: { start: "2025-10-01T00:00:00.000Z", end: input.snapshot.window.end } },
  });
  const client = runCrmHistoryAnalysis({ ...input, snapshot: { ...input.snapshot, provenance: "client-mirror" } });

  assert.match(short.warnings.join(" "), /11 months; the playbook asks for 24 to 36/);
  assert.equal(client.presentation, "client-analysis-draft");
  assert.doesNotMatch(client.label, /synthetic/);
});
