// Stage 5 of docs/research/georgia-senior-living-sample-plan.md.
// Scores and bands Georgia operators under docs/contracts/scoring-contract.md
// (account-score-v1.1) and decision 0001. The contract fixes the categories, caps, and
// rules; every value it leaves open sits in PROPOSAL below and is labeled as a proposal
// in the output until the user approves it.
//
// Hard gate: an operator with no facility serviceable or conditional for sprinkler or alarm
// work is outside the footprint and is not banded. Bands order work; they never grant
// eligibility. People-based inputs (role change, person relevance, persona, channel) wait
// for Stage 6 and score zero as unknown, never as negative evidence.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const read = async <T>(file: string) => JSON.parse(await readFile(resolve(sampleRoot, file), "utf8")) as T;

const CONTRACT = "account-score-v1.1";
const PROPOSAL_VERSION = "georgia-account-proposal-2";

// Every value below is a proposal awaiting user approval. The contract caps are noted.
const PROPOSAL = {
  // Change propensity, cap 40 (16 role change and 6 engagement need people data).
  ownershipChange: { max: 10, decayMonths: 24 }, // contract: acquisition or operating-model change, up to 10
  hiring: { max: 8, undated: 4, decayDays: 120 }, // contract: relevant facilities hiring, up to 8
  citationTrigger: { max: 6, decayMonths: 24 }, // contract: "another approved timely trigger", up to 6
  // Operational need and account context, cap 35.
  footprint: { max: 15, scale: 4 }, // 15 x (1 - e^(-(n-1)/4)) over in-footprint facilities
  regulatedEnvironment: { max: 5 }, // CMS-certified nursing home
  citationBreadth: { max: 10 }, // share of in-footprint facilities with a service-line citation since 2025
  citationRepetition: { max: 5 }, // share with sprinkler or alarm cited on more than one survey
  // Both citation shares are pulled toward the statewide footprint rate, as if each operator also had
  // this many average facilities, so one cited building no longer earns full credit.
  citationShrinkFacilities: 2,
  // Data confidence, cap 10 (persona and channel need people data).
  domain: { nameMatch: 2, wordMatch: 1 },
  geography: { serviceable: 2, conditional: 1 },
  locationProvenance: { resolved: 2, provisional: 1 },
  // Display bands on the raw score, set after inspecting this distribution.
  bands: { A: 40, B: 30, C: 20 },
};

const ASSUMED_CHANGE_AGE_MONTHS = 6; // the CMS change-of-ownership flag carries no date

type Operator = { operatorId: string; name: string; status: string; georgiaFacilityCount: number; cmsChainFacilitiesNationwide: number | null };
type ServiceFacility = {
  ccn: string;
  operatorId: string | null;
  lines: Record<string, { state: string; driveMinutes: number; branch: string }>;
};
type SignalFacility = {
  ccn: string;
  lines: Record<string, { citations: number; recentCitations: number; repeated: boolean; latestSurveyDate: string | null }>;
  recentServiceLineCitations: number;
  serviceLineCitations: number;
  cmsChangedOwnershipLast12Months: boolean;
  latestOwnershipAssociation: string | null;
  latestManagementOrganizationAssociation: string | null;
};
type Domain = { operatorId: string; domain: string | null; confidence: string; evidenceUrl: string | null };
type Job = { operatorId: string; postings: { title: string; url: string; date: string | null }[] };

const { operators } = await read<{ operators: Operator[] }>("operators.json");
const serviceability = await read<{ facilities: ServiceFacility[]; method: { timeSource: { retrievedOn: string } } }>("serviceability.json");
const signals = await read<{ facilities: SignalFacility[] }>("signals.json");
const web = await read<{ domains: Domain[]; jobs: Job[]; method: { retrievedOn: string } }>("web-signals.json");
const manifest = await read<{ datasets: { datasetId: string; retrievedOn: string; cmsModified: string }[] }>("source-manifest.json");

const asOf = manifest.datasets.find((dataset) => dataset.datasetId === "4pq5-n9py")?.retrievedOn ?? "";
const asOfTime = Date.parse(`${asOf}T00:00:00Z`);
const monthsSince = (date: string) => (asOfTime - Date.parse(`${date}T00:00:00Z`)) / (1000 * 60 * 60 * 24 * 30.44);
const decay = (age: number, horizon: number) => Math.max(0, Math.min(1, 1 - age / horizon));
const round = (value: number) => Math.round(value * 10) / 10;

const signalOf = new Map(signals.facilities.map((facility) => [facility.ccn, facility]));
const domainOf = new Map(web.domains.map((domain) => [domain.operatorId, domain]));
const jobsOf = new Map(web.jobs.map((job) => [job.operatorId, job]));

type Component = { points: number; max: number; input: string; source: string; proposal: boolean };

const anchorState = (facility: ServiceFacility) => {
  const states = [facility.lines.sprinkler_itm?.state, facility.lines.fire_alarm_itm?.state];
  return states.includes("serviceable") ? "serviceable" : states.includes("conditional") ? "conditional" : "not_serviceable";
};
const isRecentlyCited = (signal: SignalFacility) => signal.recentServiceLineCitations > 0;
const isRepeated = (signal: SignalFacility) => Boolean(signal.lines.sprinkler_itm?.repeated || signal.lines.fire_alarm_itm?.repeated);

// Statewide rates across every in-footprint facility, used as the prior for the citation shares.
const footprintSignals = serviceability.facilities
  .filter((facility) => facility.operatorId !== null && anchorState(facility) !== "not_serviceable")
  .map((facility) => signalOf.get(facility.ccn))
  .filter((item): item is SignalFacility => Boolean(item));
const recentRate = footprintSignals.filter(isRecentlyCited).length / footprintSignals.length;
const repeatedRate = footprintSignals.filter(isRepeated).length / footprintSignals.length;
const shrunkShare = (hits: number, n: number, rate: number) =>
  (hits + PROPOSAL.citationShrinkFacilities * rate) / (n + PROPOSAL.citationShrinkFacilities);

const results = operators.map((operator) => {
  const facilities = serviceability.facilities.filter((facility) => facility.operatorId === operator.operatorId);
  const inFootprint = facilities.filter((facility) => anchorState(facility) !== "not_serviceable");
  const serviceableCount = facilities.filter((facility) => anchorState(facility) === "serviceable").length;

  if (inFootprint.length === 0) {
    return {
      operatorId: operator.operatorId,
      name: operator.name,
      eligible: false,
      gate: "not serviceable: no facility within 120 minutes of a branch offering sprinkler or alarm work",
      band: null,
      score: null,
      components: {},
      explanation: null,
    };
  }

  const facilitySignals = inFootprint.map((facility) => signalOf.get(facility.ccn)).filter((item): item is SignalFacility => Boolean(item));
  const components: Record<string, Component> = {};

  // Change propensity.
  const changeAges = facilitySignals.flatMap((signal) => [
    ...(signal.latestOwnershipAssociation ? [monthsSince(signal.latestOwnershipAssociation)] : []),
    ...(signal.latestManagementOrganizationAssociation ? [monthsSince(signal.latestManagementOrganizationAssociation)] : []),
    ...(signal.cmsChangedOwnershipLast12Months ? [ASSUMED_CHANGE_AGE_MONTHS] : []),
  ]);
  const youngestChange = changeAges.length > 0 ? Math.min(...changeAges) : null;
  components.ownershipChange = {
    points: youngestChange === null ? 0 : round(PROPOSAL.ownershipChange.max * decay(youngestChange, PROPOSAL.ownershipChange.decayMonths)),
    max: PROPOSAL.ownershipChange.max,
    input: youngestChange === null ? "no dated ownership or management change" : `latest ownership or management change ${round(youngestChange)} months before ${asOf}`,
    source: "y2hd-n93e.association_date; 4pq5-n9py.provider_changed_ownership_in_last_12_months",
    proposal: true,
  };

  const postings = jobsOf.get(operator.operatorId)?.postings ?? [];
  const postingAges = postings.map((posting) => (posting.date ? (asOfTime - Date.parse(posting.date)) / 86_400_000 : Number.NaN));
  const datedAges = postingAges.filter((age) => !Number.isNaN(age) && age >= 0);
  const hiringPoints =
    postings.length === 0
      ? 0
      : Math.max(
          PROPOSAL.hiring.undated,
          ...datedAges.map((age) => PROPOSAL.hiring.undated + (PROPOSAL.hiring.max - PROPOSAL.hiring.undated) * decay(age, PROPOSAL.hiring.decayDays)),
        );
  components.hiring = {
    points: round(hiringPoints),
    max: PROPOSAL.hiring.max,
    input: postings.length === 0 ? "no maintenance or facilities posting found" : `${postings.length} posting candidate(s), not confirmed open`,
    source: `web-signals.json jobs (Serper, ${web.method.retrievedOn})`,
    proposal: true,
  };

  const latestCitation = facilitySignals
    .flatMap((signal) => Object.values(signal.lines).map((line) => line.latestSurveyDate))
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  components.citationTrigger = {
    points: latestCitation ? round(PROPOSAL.citationTrigger.max * decay(monthsSince(latestCitation), PROPOSAL.citationTrigger.decayMonths)) : 0,
    max: PROPOSAL.citationTrigger.max,
    input: latestCitation ? `latest service-line fire citation surveyed ${latestCitation}` : "no service-line fire citation",
    source: "ifjz-ge4w.survey_date via signals.json",
    proposal: true,
  };
  components.roleChange = { points: 0, max: 16, input: "unknown until Stage 6 people pass", source: "none yet", proposal: false };
  components.engagement = { points: 0, max: 0, input: "slot used by the citation trigger proposal", source: "none", proposal: true };

  // Operational need and account context.
  const n = inFootprint.length;
  components.footprint = {
    points: round(PROPOSAL.footprint.max * (1 - Math.exp(-(n - 1) / PROPOSAL.footprint.scale))),
    max: PROPOSAL.footprint.max,
    input: `${n} Georgia facilities inside the footprint`,
    source: "serviceability.json (OSRM drive times, decision 0003 bands)",
    proposal: true,
  };
  components.regulatedEnvironment = {
    points: PROPOSAL.regulatedEnvironment.max,
    max: PROPOSAL.regulatedEnvironment.max,
    input: "CMS-certified nursing homes under federal life-safety surveys",
    source: "4pq5-n9py",
    proposal: true,
  };
  const recentHits = facilitySignals.filter(isRecentlyCited).length;
  const recentShare = shrunkShare(recentHits, n, recentRate);
  components.citationBreadth = {
    points: round(PROPOSAL.citationBreadth.max * recentShare),
    max: PROPOSAL.citationBreadth.max,
    input: `${recentHits} of ${n} footprint facilities cited for a service line since 2025; ${Math.round(recentShare * 100)}% after pulling toward the ${Math.round(recentRate * 100)}% statewide rate`,
    source: "ifjz-ge4w via signals.json",
    proposal: true,
  };
  const repeatedHits = facilitySignals.filter(isRepeated).length;
  const repeatedShare = shrunkShare(repeatedHits, n, repeatedRate);
  components.citationRepetition = {
    points: round(PROPOSAL.citationRepetition.max * repeatedShare),
    max: PROPOSAL.citationRepetition.max,
    input: `${repeatedHits} of ${n} footprint facilities with sprinkler or alarm cited on more than one survey; ${Math.round(repeatedShare * 100)}% after pulling toward the ${Math.round(repeatedRate * 100)}% statewide rate`,
    source: "ifjz-ge4w via signals.json",
    proposal: true,
  };

  // Data confidence.
  const domain = domainOf.get(operator.operatorId);
  components.domain = {
    points: domain?.confidence === "name_match" ? PROPOSAL.domain.nameMatch : domain?.confidence === "word_match" ? PROPOSAL.domain.wordMatch : 0,
    max: 2,
    input: domain?.domain ? `${domain.domain} (${domain.confidence})` : "no confirmed domain",
    source: `web-signals.json domains (Serper, ${web.method.retrievedOn})`,
    proposal: domain?.confidence === "word_match",
  };
  components.geography = {
    points: serviceableCount > 0 ? PROPOSAL.geography.serviceable : PROPOSAL.geography.conditional,
    max: 2,
    input: serviceableCount > 0 ? `${serviceableCount} facilities within 90 minutes` : "conditional only: 90 to 120 minutes, needs manager approval",
    source: `serviceability.json (OSRM, ${serviceability.method.timeSource.retrievedOn})`,
    proposal: serviceableCount === 0,
  };
  components.locationProvenance = {
    points: operator.status === "resolved" ? PROPOSAL.locationProvenance.resolved : PROPOSAL.locationProvenance.provisional,
    max: 2,
    input: operator.status === "resolved" ? "facility list resolved from CMS" : "provisional: a facility awaits manual review",
    source: "operators.json",
    proposal: operator.status !== "resolved",
  };
  components.personaAndChannel = { points: 0, max: 4, input: "unknown until Stage 6 people pass", source: "none yet", proposal: false };

  const score = round(Object.values(components).reduce((sum, component) => sum + component.points, 0));
  const band = score >= PROPOSAL.bands.A ? "A" : score >= PROPOSAL.bands.B ? "B" : score >= PROPOSAL.bands.C ? "C" : "Watch";

  // The explanation uses only inputs that earned points.
  const reasons: string[] = [];
  reasons.push(
    serviceableCount > 0
      ? `Anchorpoint reaches ${serviceableCount === n ? (n === 1 ? "its site" : `all ${n} of its footprint sites`) : `${serviceableCount} of its ${n} footprint sites`} within 90 minutes`
      : "its sites sit 90 to 120 minutes from a capable branch",
  );
  if (components.footprint.points > 0) reasons.push(`it runs ${n} nursing homes within 120 minutes of a capable branch`);
  if (components.citationBreadth.points > 0) {
    reasons.push(`${Math.round(recentShare * 100)}% of those sites were cited for a service line since 2025`);
  }
  if (components.citationRepetition.points > 0) reasons.push("sprinkler or alarm deficiencies repeat across surveys");
  if (components.ownershipChange.points > 0) reasons.push("ownership or management changed recently");
  if (components.hiring.points > 0) reasons.push("it appears to be hiring maintenance or facilities staff");
  const joined = reasons.length > 1 ? `${reasons.slice(0, -1).join(", ")}, and ${reasons.at(-1)}` : reasons[0];
  const explanation = `Band ${band} because ${joined}.`;

  return {
    operatorId: operator.operatorId,
    name: operator.name,
    eligible: true,
    gate: null,
    identityStatus: operator.status,
    band,
    score,
    footprintFacilities: n,
    explanation,
    components,
  };
});

const eligible = results.filter((result) => result.eligible).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.operatorId.localeCompare(b.operatorId));
const ineligible = results.filter((result) => !result.eligible).sort((a, b) => a.operatorId.localeCompare(b.operatorId));

await writeFile(
  resolve(sampleRoot, "tiers.json"),
  `${JSON.stringify(
    {
      method: {
        script: "scripts/georgia-sample/tier.ts",
        contract: CONTRACT,
        proposalVersion: PROPOSAL_VERSION,
        status: "proposal: open parameters await user approval",
        asOf,
        proposal: PROPOSAL,
        notes: [
          "Bands order work and never grant eligibility; a manager may select any eligible operator.",
          "People-based inputs score zero as unknown until Stage 6, so today's maximum is 65 of 100.",
          "Hard gate: at least one facility serviceable or conditional for sprinkler or alarm work.",
        ],
      },
      operators: eligible,
      outsideFootprint: ineligible,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const bandCounts = Object.fromEntries(["A", "B", "C", "Watch"].map((band) => [band, eligible.filter((result) => result.band === band).length]));
const scores = eligible.map((result) => result.score ?? 0);
process.stdout.write(
  `${JSON.stringify(
    {
      eligible: eligible.length,
      outsideFootprint: ineligible.length,
      bands: bandCounts,
      scoreRange: [Math.min(...scores), Math.max(...scores)],
      median: scores[Math.floor(scores.length / 2)],
      deciles: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => scores[Math.floor(scores.length * (1 - q))] ?? null),
    },
    null,
    2,
  )}\n`,
);
