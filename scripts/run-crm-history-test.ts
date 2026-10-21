import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  defaultCrmHistoryOptions,
  runCrmHistoryAnalysis,
  type FindingDisposition,
  type Invoice,
  type MarketRecord,
} from "../packages/core/src/crm-history.ts";
import type { SalesforceAuditMapping, SalesforceSnapshot } from "../packages/core/src/salesforce-mapping.ts";

// Runs the CRM history analysis pipeline on its synthetic test fixture. The output
// proves the pipeline runs end to end; it is not a finding (decision 0010).

const fixtureDir = resolve(import.meta.dirname, "../fixtures/analysis/crm-history-test-v1");
const input = JSON.parse(await readFile(resolve(fixtureDir, "input/history.json"), "utf8")) as {
  synthetic: true;
  mapping: SalesforceAuditMapping;
  snapshot: SalesforceSnapshot;
  invoices: Invoice[];
  market: MarketRecord[];
};
const dispositions = JSON.parse(await readFile(resolve(fixtureDir, "input/dispositions.json"), "utf8")) as {
  dispositions: Record<string, FindingDisposition>;
};
if (input.synthetic !== true || input.snapshot.provenance !== "synthetic-test-fixture") {
  throw new Error("This script runs only on the labelled synthetic test fixture.");
}

const result = runCrmHistoryAnalysis({
  snapshot: input.snapshot,
  mapping: input.mapping,
  invoices: input.invoices,
  market: input.market,
  dispositions: dispositions.dispositions,
  options: { ...defaultCrmHistoryOptions, asOf: input.mapping.config.asOf },
});

const rateText = (rate: { numerator: number; denominator: number; thin: boolean }) =>
  `${rate.numerator} of ${rate.denominator}${rate.thin ? " (thin)" : ""}`;

console.log(`${result.label}`);
console.log(`Presentation: ${result.presentation}. Status: ${result.status}.`);
for (const blocker of result.blockers) console.log(`Blocked: ${blocker}`);
for (const warning of result.warnings) console.log(`Warning: ${warning}`);
console.log(`Snapshot ${result.snapshot.windowStart} to ${result.snapshot.windowEnd}, ${result.snapshot.windowMonths} months, sha256 ${result.snapshot.checksum}`);
console.log(
  `Audit: ${result.audit.analysisFindings.length} analysis findings, ${result.audit.excludedRecordIds.length} excluded records, ${Object.keys(result.audit.mergedAccountIds).length} merged accounts.`,
);
console.log(
  `Billing: ${result.reconciliation.reconciledWins.length} reconciled wins, ${result.reconciliation.wonNotInvoiced.length} won but never invoiced, ${result.reconciliation.customerFlagButChurned.length} customer flags on churned operators.`,
);
console.log(
  `Parents: ${result.parents.length}. Market join: ${result.marketJoin.filter((join) => join.confidence === "domain").length} by domain, ${result.marketJoin.filter((join) => join.confidence === "name-state").length} by name and state, ${result.marketJoin.filter((join) => join.confidence === "none").length} unmatched.`,
);
for (const cut of result.cuts) {
  console.log(`Cut: ${cut.trait}`);
  for (const bucket of cut.buckets) {
    console.log(
      `  ${bucket.bucket}: won ${rateText(bucket.winRate)}, retained ${rateText(bucket.retention)}, expanded ${rateText(bucket.expansion)}, first-year value ${bucket.firstYearValue.mean ?? "n/a"} over ${bucket.firstYearValue.customers}, median cycle ${bucket.salesCycleDays.median ?? "n/a"} days`,
    );
  }
}
for (const hypothesis of result.hypotheses) console.log(`Draft hypothesis (${hypothesis.confidence}): ${hypothesis.statement}`);
for (const question of result.questions) console.log(question);
