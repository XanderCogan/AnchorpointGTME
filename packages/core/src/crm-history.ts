import { createHash } from "node:crypto";
import { auditCrm } from "./audit.ts";
import {
  mapSalesforceToAuditRelease,
  salesforceInstant,
  type MappingGap,
  type SalesforceAuditMapping,
  type SalesforceRecordPayload,
  type SalesforceSnapshot,
} from "./salesforce-mapping.ts";
import type { Finding } from "./types.ts";

// CRM history analysis from docs/research/crm-icp-analysis-playbook.md, steps 1 to 7
// and the machine half of step 9. It runs over a frozen snapshot of the read-only
// Salesforce mirror. Anchorpoint has no real CRM history (decision 0010), so in this
// project it only ever runs on labelled synthetic test fixtures, and its output on
// them proves the queries run; it is never a finding.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Invoice {
  id: string;
  accountId: string;
  invoicedAt: string;
  amount: number;
}

// Public market traits from the TAM pipeline, one row per operator.
export interface MarketRecord {
  marketId: string;
  name: string;
  state: string | null;
  domain: string | null;
  facilityType: string | null;
  citationDates: string[];
  driveTimeMinutes: number | null;
}

// Step 2: every analysis-relevant audit finding needs a human disposition before
// outcomes are cut. Nothing is excluded, merged, or accepted silently.
export type FindingDisposition =
  | { action: "exclude"; approvedBy: string; note: string }
  | { action: "merge"; survivorId: string; approvedBy: string; note: string }
  | { action: "accept"; approvedBy: string; note: string };

export interface CrmHistoryOptions {
  asOf: string;
  minWindowMonths: number;
  maxWindowMonths: number;
  // A won opportunity needs an invoice on its operator within this many days of close.
  wonInvoiceGraceDays: number;
  // An operator with no invoice for this many days before asOf has churned.
  churnGapDays: number;
  // Rates with a denominator below this are questions, not findings.
  thinSampleSize: number;
  // Minimum absolute gap between a bucket and the rest before a hypothesis is drafted.
  hypothesisGap: number;
}

export const defaultCrmHistoryOptions: Omit<CrmHistoryOptions, "asOf"> = {
  minWindowMonths: 24,
  maxWindowMonths: 36,
  wonInvoiceGraceDays: 90,
  churnGapDays: 120,
  thinSampleSize: 10,
  hypothesisGap: 0.15,
};

export interface CrmHistoryInput {
  snapshot: SalesforceSnapshot;
  mapping: SalesforceAuditMapping;
  invoices: Invoice[];
  market: MarketRecord[];
  dispositions: Record<string, FindingDisposition>;
  options: CrmHistoryOptions;
}

// Rules that change which records or outcomes can be trusted: duplicates, orphans,
// owners, stale opportunities, and lifecycle contradictions.
export const analysisRuleIds: ReadonlySet<string> = new Set([
  "CRM-COMPANY-001",
  "CRM-CONTACT-001",
  "CRM-DEAL-001",
  "CRM-DEAL-002",
  "CRM-OWNER-001",
  "CRM-LIFECYCLE-001",
]);

export interface Rate {
  numerator: number;
  denominator: number;
  thin: boolean;
}

export interface BucketMetrics {
  bucket: string;
  winRate: Rate;
  firstYearValue: { customers: number; mean: number | null; thin: boolean };
  salesCycleDays: { wins: number; median: number | null; thin: boolean };
  retention: Rate;
  expansion: Rate;
}

export interface TraitCut {
  trait: string;
  buckets: BucketMetrics[];
}

export interface DraftHypothesis {
  trait: string;
  bucket: string;
  metric: "winRate" | "retention";
  statement: string;
  bucketRate: Rate;
  restRate: Rate;
  confidence: "low" | "medium";
  caseAgainst: string[];
  // Always true until a human has interviewed sales and approved the hypothesis.
  draft: true;
}

export interface CrmHistoryResult {
  provenance: SalesforceSnapshot["provenance"];
  // Synthetic fixture output proves the pipeline runs and must not be presented as a finding.
  presentation: "test-output-not-findings" | "client-analysis-draft";
  label: string;
  status: "complete" | "blocked";
  blockers: string[];
  warnings: string[];
  snapshot: { windowStart: string; windowEnd: string; windowMonths: number; checksum: string; counts: Record<string, number> };
  mappingGaps: MappingGap[];
  audit: {
    analysisFindings: Finding[];
    undisposed: string[];
    excludedRecordIds: string[];
    mergedAccountIds: Record<string, string>;
  };
  reconciliation: {
    reconciledWins: string[];
    wonNotInvoiced: string[];
    customerFlagButChurned: string[];
    invoicesWithoutAccount: string[];
  };
  parents: { parentId: string; accountIds: string[]; siteCount: number }[];
  marketJoin: { parentId: string; marketId: string | null; confidence: "domain" | "name-state" | "none"; matchedAccountId: string | null }[];
  cuts: TraitCut[];
  hypotheses: DraftHypothesis[];
  questions: string[];
}

// Step 1: a checksum over records sorted by object and Id, excluding `attributes`,
// identifies the frozen snapshot the analysis used.
export function snapshotChecksum(snapshot: SalesforceSnapshot): string {
  const hash = createHash("sha256");
  for (const key of Object.keys(snapshot.records).sort()) {
    const sorted = [...(snapshot.records[key as keyof typeof snapshot.records] ?? [])].sort((a, b) =>
      a.Id.localeCompare(b.Id),
    );
    for (const record of sorted) {
      const { attributes: _attributes, ...rest } = record;
      const canonical = Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)));
      hash.update(`${key}\n${JSON.stringify(canonical)}\n`);
    }
  }
  return hash.digest("hex");
}

function monthsBetween(start: string, end: string): number {
  const from = new Date(start);
  const to = new Date(end);
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return host.replace(/^www\./, "").replace(/\.$/, "") || null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|lp|corp|co|company|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rate(numerator: number, denominator: number, thinSampleSize: number): Rate {
  return { numerator, denominator, thin: denominator < thinSampleSize };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function str(record: SalesforceRecordPayload, field: string): string | null {
  const value = record[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function runCrmHistoryAnalysis(input: CrmHistoryInput): CrmHistoryResult {
  const { snapshot, mapping, options } = input;
  const asOf = Date.parse(options.asOf);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const records = (key: keyof SalesforceSnapshot["records"]) => snapshot.records[key] ?? [];

  // Step 1: pull and freeze.
  const windowMonths = monthsBetween(snapshot.window.start, snapshot.window.end);
  if (windowMonths < options.minWindowMonths || windowMonths > options.maxWindowMonths) {
    warnings.push(
      `Snapshot window is ${windowMonths} months; the playbook asks for ${options.minWindowMonths} to ${options.maxWindowMonths}.`,
    );
  }
  const counts = Object.fromEntries(
    Object.entries(snapshot.records).map(([key, list]) => [key, list?.length ?? 0]),
  );

  // Step 2: audit before trusting.
  const mapped = mapSalesforceToAuditRelease(snapshot, mapping);
  const analysisFindings = auditCrm(mapped.release).filter((finding) => analysisRuleIds.has(finding.ruleId));
  const undisposed = analysisFindings.map((f) => f.findingId).filter((id) => !input.dispositions[id]);
  if (undisposed.length > 0) {
    blockers.push(`${undisposed.length} analysis-relevant audit findings have no human disposition.`);
  }
  const excluded = new Set<string>();
  const mergedInto = new Map<string, string>();
  for (const finding of analysisFindings) {
    const disposition = input.dispositions[finding.findingId];
    if (!disposition) continue;
    if (disposition.action === "exclude") finding.affectedIds.forEach((id) => excluded.add(id));
    if (disposition.action === "merge") {
      if (!finding.affectedIds.includes(disposition.survivorId)) {
        blockers.push(`Merge for ${finding.findingId} names a survivor outside the duplicate group.`);
        continue;
      }
      for (const id of finding.affectedIds) if (id !== disposition.survivorId) mergedInto.set(id, disposition.survivorId);
    }
  }
  for (const id of Object.keys(input.dispositions)) {
    if (!analysisFindings.some((finding) => finding.findingId === id)) {
      warnings.push(`Disposition ${id} matches no current audit finding.`);
    }
  }

  const accounts = records("account").filter((account) => !excluded.has(account.Id));
  const accountById = new Map(accounts.map((account) => [account.Id, account]));
  const canonicalAccount = (id: string | null): string | null => {
    if (!id) return null;
    const merged = mergedInto.get(id) ?? id;
    return accountById.has(merged) ? merged : null;
  };

  // Step 4: resolve parents and sites. Walk ParentId to the top, cycle-safe.
  const parentOf = (id: string): string => {
    const seen = new Set<string>();
    let current = id;
    while (!seen.has(current)) {
      seen.add(current);
      const next = canonicalAccount(str(accountById.get(current)!, "ParentId"));
      if (!next) return current;
      current = next;
    }
    warnings.push(`Account hierarchy cycle at ${id}; treated ${current} as the parent.`);
    return current;
  };
  const parentByAccount = new Map<string, string>();
  for (const account of accounts) {
    if (mergedInto.has(account.Id)) continue;
    parentByAccount.set(account.Id, parentOf(account.Id));
  }
  for (const [duplicate, survivor] of mergedInto) {
    if (parentByAccount.has(survivor)) parentByAccount.set(duplicate, parentByAccount.get(survivor)!);
  }
  const parentFor = (accountId: string | null): string | null => {
    const canonical = canonicalAccount(accountId);
    return canonical ? (parentByAccount.get(canonical) ?? null) : null;
  };

  const siteCount = new Map<string, number>();
  for (const site of records("site")) {
    const parent = parentFor(str(site, mapping.siteAccountField));
    if (parent) siteCount.set(parent, (siteCount.get(parent) ?? 0) + 1);
  }
  const parentIds = [...new Set(parentByAccount.values())].sort();
  const parents = parentIds.map((parentId) => ({
    parentId,
    accountIds: [...parentByAccount].filter(([, p]) => p === parentId).map(([id]) => id).sort(),
    siteCount: siteCount.get(parentId) ?? 0,
  }));

  // Step 3: reconcile with billing. Invoices are the truth for wins, value, and churn.
  const invoicesByParent = new Map<string, Invoice[]>();
  const invoicesWithoutAccount: string[] = [];
  for (const invoice of input.invoices) {
    const parent = parentFor(invoice.accountId);
    if (!parent) {
      invoicesWithoutAccount.push(invoice.id);
      continue;
    }
    const list = invoicesByParent.get(parent) ?? [];
    list.push(invoice);
    invoicesByParent.set(parent, list);
  }
  for (const list of invoicesByParent.values()) list.sort((a, b) => Date.parse(a.invoicedAt) - Date.parse(b.invoicedAt));

  const windowStart = Date.parse(snapshot.window.start);
  const windowEnd = Date.parse(snapshot.window.end);
  interface Outcome {
    id: string;
    parentId: string;
    won: boolean;
    closedAt: number;
    createdAt: number;
    leadSource: string;
  }
  const outcomes: Outcome[] = [];
  const reconciledWins: string[] = [];
  const wonNotInvoiced: string[] = [];
  for (const opportunity of records("opportunity")) {
    if (excluded.has(opportunity.Id) || opportunity.IsClosed !== true) continue;
    const type = str(opportunity, "Type");
    const pipeline = (type && mapping.pipelineByOpportunityType[type]) || mapping.defaultPipeline;
    if (pipeline !== "new_business") continue;
    const parentId = parentFor(str(opportunity, "AccountId"));
    const closedAt = Date.parse(salesforceInstant(opportunity.CloseDate) ?? "");
    const createdAt = Date.parse(salesforceInstant(opportunity.CreatedDate) ?? "");
    if (!parentId || !Number.isFinite(closedAt) || closedAt < windowStart || closedAt > windowEnd) continue;
    let won = opportunity.IsWon === true;
    if (won) {
      const invoiced = (invoicesByParent.get(parentId) ?? []).some((invoice) => {
        const at = Date.parse(invoice.invoicedAt);
        return at >= closedAt && at <= closedAt + options.wonInvoiceGraceDays * DAY_MS;
      });
      if (!invoiced) {
        // Not a win, and not a clean loss either: held out and listed for review.
        wonNotInvoiced.push(opportunity.Id);
        continue;
      }
      reconciledWins.push(opportunity.Id);
    }
    outcomes.push({
      id: opportunity.Id,
      parentId,
      won,
      closedAt,
      createdAt,
      leadSource: str(opportunity, "LeadSource") ?? "not recorded",
    });
  }

  interface CustomerOutcome {
    parentId: string;
    firstWinAt: number;
    firstYearValue: number;
    retentionEligible: boolean;
    retained: boolean;
    expansionEligible: boolean;
    expanded: boolean;
  }
  const customers = new Map<string, CustomerOutcome>();
  for (const outcome of outcomes.filter((item) => item.won).sort((a, b) => a.closedAt - b.closedAt)) {
    if (customers.has(outcome.parentId)) continue;
    const invoices = (invoicesByParent.get(outcome.parentId) ?? []).filter(
      (invoice) => Date.parse(invoice.invoicedAt) >= outcome.closedAt,
    );
    const first = Date.parse(invoices[0]!.invoicedAt);
    const last = Date.parse(invoices.at(-1)!.invoicedAt);
    const sumBetween = (from: number, to: number) =>
      invoices
        .filter((invoice) => Date.parse(invoice.invoicedAt) >= from && Date.parse(invoice.invoicedAt) < to)
        .reduce((total, invoice) => total + invoice.amount, 0);
    const firstYearValue = sumBetween(first, first + 365 * DAY_MS);
    const secondYearValue = sumBetween(first + 365 * DAY_MS, first + 730 * DAY_MS);
    const retained = last >= asOf - options.churnGapDays * DAY_MS;
    customers.set(outcome.parentId, {
      parentId: outcome.parentId,
      firstWinAt: outcome.closedAt,
      firstYearValue,
      retentionEligible: first <= asOf - 365 * DAY_MS,
      retained,
      expansionEligible: first <= asOf - 730 * DAY_MS,
      expanded: secondYearValue > firstYearValue,
    });
  }

  const customerFlagButChurned = parentIds.filter((parentId) => {
    const flagged = parents
      .find((parent) => parent.parentId === parentId)!
      .accountIds.some((id) => mapping.customerAccountTypes.includes(str(accountById.get(id)!, "Type") ?? ""));
    const lastInvoice = invoicesByParent.get(parentId)?.at(-1);
    return flagged && (!lastInvoice || Date.parse(lastInvoice.invoicedAt) < asOf - options.churnGapDays * DAY_MS);
  });

  // Step 5: join the market data by domain first, then normalized name and state.
  const marketByDomain = new Map<string, MarketRecord>();
  const marketByNameState = new Map<string, MarketRecord>();
  for (const row of input.market) {
    const domain = normalizeDomain(row.domain);
    if (domain) marketByDomain.set(domain, row);
    marketByNameState.set(`${normalizeName(row.name)}|${row.state ?? ""}`, row);
  }
  const marketJoin = parents.map(({ parentId, accountIds }) => {
    const ordered = [parentId, ...accountIds.filter((id) => id !== parentId)];
    for (const [confidence, lookup] of [
      ["domain", (account: SalesforceRecordPayload) => marketByDomain.get(normalizeDomain(str(account, "Website")) ?? "")],
      [
        "name-state",
        (account: SalesforceRecordPayload) =>
          marketByNameState.get(`${normalizeName(str(account, "Name") ?? "")}|${str(account, "BillingState") ?? ""}`),
      ],
    ] as const) {
      for (const id of ordered) {
        const row = lookup(accountById.get(id)!);
        if (row) return { parentId, marketId: row.marketId, confidence, matchedAccountId: id };
      }
    }
    return { parentId, marketId: null, confidence: "none" as const, matchedAccountId: null };
  });
  const unmatched = marketJoin.filter((join) => join.marketId === null).length;
  if (unmatched > 0) warnings.push(`${unmatched} of ${marketJoin.length} parents have no market match; their market traits are "unmatched".`);
  const marketByParent = new Map(
    marketJoin.map((join) => [join.parentId, input.market.find((row) => row.marketId === join.marketId)]),
  );

  // Step 6: cut the outcomes by trait.
  const chainBand = (parentId: string) => {
    const sites = siteCount.get(parentId) ?? 0;
    return sites === 0 ? "no sites recorded" : sites === 1 ? "1 site" : sites <= 5 ? "2-5 sites" : "6+ sites";
  };
  const traits: { trait: string; bucketOf: (outcome: { parentId: string; closedAt: number; leadSource?: string }) => string }[] = [
    { trait: "chain size", bucketOf: ({ parentId }) => chainBand(parentId) },
    { trait: "facility type", bucketOf: ({ parentId }) => marketByParent.get(parentId)?.facilityType ?? "unmatched" },
    {
      trait: "citations before the deal",
      bucketOf: ({ parentId, closedAt }) => {
        const row = marketByParent.get(parentId);
        if (!row) return "unmatched";
        return row.citationDates.some((date) => Date.parse(date) < closedAt) ? "cited before" : "no prior citation";
      },
    },
    {
      trait: "drive time to branch",
      bucketOf: ({ parentId }) => {
        const minutes = marketByParent.get(parentId)?.driveTimeMinutes;
        if (minutes === undefined || minutes === null) return "unmatched";
        return minutes <= 60 ? "within 60 minutes" : "over 60 minutes";
      },
    },
    { trait: "lead source", bucketOf: ({ leadSource }) => leadSource ?? "not recorded" },
    // OpportunityContactRole is not mirrored yet, so buying role cannot be cut.
    { trait: "buying role", bucketOf: () => "not mirrored" },
  ];

  const firstWinLeadSource = new Map<string, string>();
  for (const outcome of outcomes.filter((item) => item.won).sort((a, b) => a.closedAt - b.closedAt)) {
    if (!firstWinLeadSource.has(outcome.parentId)) firstWinLeadSource.set(outcome.parentId, outcome.leadSource);
  }

  const n = options.thinSampleSize;
  const metricsFor = (bucket: string, scoped: Outcome[], scopedCustomers: CustomerOutcome[]): BucketMetrics => {
    const wins = scoped.filter((item) => item.won);
    const values = scopedCustomers.map((customer) => customer.firstYearValue);
    const cycles = wins.map((item) => Math.round((item.closedAt - item.createdAt) / DAY_MS)).filter(Number.isFinite);
    const retentionPool = scopedCustomers.filter((customer) => customer.retentionEligible);
    const expansionPool = scopedCustomers.filter((customer) => customer.expansionEligible);
    return {
      bucket,
      winRate: rate(wins.length, scoped.length, n),
      firstYearValue: {
        customers: values.length,
        mean: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
        thin: values.length < n,
      },
      salesCycleDays: { wins: cycles.length, median: median(cycles), thin: cycles.length < n },
      retention: rate(retentionPool.filter((customer) => customer.retained).length, retentionPool.length, n),
      expansion: rate(expansionPool.filter((customer) => customer.expanded).length, expansionPool.length, n),
    };
  };

  const cuts: TraitCut[] = traits.map(({ trait, bucketOf }) => {
    const outcomeBucket = new Map(outcomes.map((outcome) => [outcome.id, bucketOf(outcome)]));
    const customerBucket = new Map(
      [...customers.values()].map((customer) => [
        customer.parentId,
        bucketOf({
          parentId: customer.parentId,
          closedAt: customer.firstWinAt,
          leadSource: firstWinLeadSource.get(customer.parentId),
        }),
      ]),
    );
    const buckets = [...new Set([...outcomeBucket.values(), ...customerBucket.values()])].sort();
    return {
      trait,
      buckets: buckets.map((bucket) =>
        metricsFor(
          bucket,
          outcomes.filter((outcome) => outcomeBucket.get(outcome.id) === bucket),
          [...customers.values()].filter((customer) => customerBucket.get(customer.parentId) === bucket),
        ),
      ),
    };
  });

  // Steps 7 and 9: respect sample size, then draft soft hypotheses with the case against.
  const uninformativeBuckets = new Set(["unmatched", "not recorded", "not mirrored", "no sites recorded"]);
  const hypotheses: DraftHypothesis[] = [];
  const questions: string[] = [];
  const excludedCount = excluded.size + wonNotInvoiced.length;
  for (const cut of cuts) {
    if (cut.buckets.length < 2) continue;
    for (const bucket of cut.buckets) {
      if (uninformativeBuckets.has(bucket.bucket)) continue;
      for (const metric of ["winRate", "retention"] as const) {
        // Unknown buckets are not a comparison group.
        const rest = cut.buckets.filter((other) => other.bucket !== bucket.bucket && !uninformativeBuckets.has(other.bucket));
        const restRate = rate(
          rest.reduce((total, other) => total + other[metric].numerator, 0),
          rest.reduce((total, other) => total + other[metric].denominator, 0),
          n,
        );
        const own = bucket[metric];
        if (own.denominator === 0 || restRate.denominator === 0) continue;
        const gap = own.numerator / own.denominator - restRate.numerator / restRate.denominator;
        if (gap < options.hypothesisGap) continue;
        const verb = metric === "winRate" ? "won" : "renewed";
        const comparison = `${own.numerator} of ${own.denominator} against ${restRate.numerator} of ${restRate.denominator} for the rest`;
        if (own.thin || restRate.thin) {
          questions.push(`Ask sales: ${cut.trait} "${bucket.bucket}" ${verb} ${comparison}, below ${n} outcomes.`);
          continue;
        }
        const caseAgainst = [
          `Only ${own.denominator + restRate.denominator} outcomes in total; one quarter of deals could reverse it.`,
          `${excludedCount} records were excluded or held out by the audit and billing reconciliation.`,
          "Correlation in one client's history; reps and customers have not explained why yet.",
        ];
        if (unmatched > 0) caseAgainst.push(`${unmatched} parents have no market match.`);
        hypotheses.push({
          trait: cut.trait,
          bucket: bucket.bucket,
          metric,
          statement: `Operators with ${cut.trait} "${bucket.bucket}" ${verb} more often: ${comparison}.`,
          bucketRate: own,
          restRate,
          confidence: own.denominator >= 2 * n && restRate.denominator >= 2 * n ? "medium" : "low",
          caseAgainst,
          draft: true,
        });
      }
    }
  }

  const synthetic = snapshot.provenance === "synthetic-test-fixture";
  return {
    provenance: snapshot.provenance,
    presentation: synthetic ? "test-output-not-findings" : "client-analysis-draft",
    label: synthetic ? `${snapshot.label}: synthetic test fixture output, not a finding` : snapshot.label,
    status: blockers.length > 0 ? "blocked" : "complete",
    blockers,
    warnings,
    snapshot: {
      windowStart: snapshot.window.start,
      windowEnd: snapshot.window.end,
      windowMonths,
      checksum: snapshotChecksum(snapshot),
      counts,
    },
    mappingGaps: mapped.gaps,
    audit: {
      analysisFindings,
      undisposed,
      excludedRecordIds: [...excluded].sort(),
      mergedAccountIds: Object.fromEntries([...mergedInto].sort()),
    },
    reconciliation: {
      reconciledWins: reconciledWins.sort(),
      wonNotInvoiced: wonNotInvoiced.sort(),
      customerFlagButChurned,
      invoicesWithoutAccount: invoicesWithoutAccount.sort(),
    },
    parents,
    marketJoin,
    // A blocked run withholds cuts and hypotheses so untrusted records cannot leak into them.
    cuts: blockers.length > 0 ? [] : cuts,
    hypotheses: blockers.length > 0 ? [] : hypotheses,
    questions: blockers.length > 0 ? [] : questions,
  };
}
