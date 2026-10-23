// Stage 5 of docs/research/georgia-senior-living-sample-plan.md.
// Scores and bands Georgia operators under docs/contracts/scoring-contract.md
// (account-score-v1.1) and decision 0001. The contract fixes the categories, caps, and
// rules; every value it leaves open sits in PARAMETERS below. The user approved those values
// as tiering proposal 2 on 2026-10-20.
//
// Hard gate: an operator with no facility serviceable or conditional for sprinkler or alarm
// work is outside the footprint and is not banded. Bands order work; they never grant
// eligibility. People-based inputs (role change, persona, channel) come from the Stage 6
// people pass in people-coverage.json when it exists; an operator the pass has not covered
// scores them zero as unknown, never as negative evidence.
//
// Account value (decision 0009) sits beside the score, never inside it. Every assumed price
// sits in VALUE_ASSUMPTIONS, and value is computed only after the score and band are fixed.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const read = async <T>(file: string) => JSON.parse(await readFile(resolve(sampleRoot, file), "utf8")) as T;

const CONTRACT = "account-score-v1.1";
const PARAMETERS_VERSION = "georgia-account-proposal-2";

// Approved by the user on 2026-10-20 as tiering proposal 2. The contract caps are noted.
export const PARAMETERS = {
  // Change propensity, cap 40 (the 6 engagement points are used by the citation trigger).
  roleChange: { max: 16 }, // contract: role change, up to 16; points come from people-coverage.json under role-change-proposal-1
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
  // Data confidence, cap 10.
  personaVerified: 2, // contract: persona and current employment verified, 2
  channelVerified: 2, // contract: at least one channel-specific contact method verified, 2
  domain: { nameMatch: 2, wordMatch: 1 },
  geography: { serviceable: 2, conditional: 1 },
  locationProvenance: { resolved: 2, provisional: 1 },
  // Display bands on the raw score, set after inspecting this distribution.
  bands: { A: 40, B: 30, C: 20 },
};

// Decision 0009. Every figure here is an assumption to calibrate against real quotes or first deals.
export const VALUE_ASSUMPTIONS = {
  version: "georgia-value-1",
  decision: "docs/decisions/0009-account-value-model.md",
  baseAnnualUsd: 9_300, // median 100-bed home: about $6,000 recurring ITM plus repair at $0.55 per $1 (decision 0006)
  baseBeds: 100,
  bedExponent: 0.7, // devices, heads, and systems grow more slowly than beds
  conditionalFactor: 0.75, // 90 to 120 minutes from a capable branch, for travel cost to serve
  fiveYearMultiple: 4.0, // five years at 89 percent logo retention (decision 0006), undiscounted
  bands: { Large: 500_000, Mid: 100_000 }, // five-year value cutoffs; Small below Mid
  nearTheJawsMinutes: 60, // small single-site C or Watch accounts get rep time only within this drive
};
export type ValueAssumptions = typeof VALUE_ASSUMPTIONS;

const ASSUMED_CHANGE_AGE_MONTHS = 6; // the CMS change-of-ownership flag carries no date
const ANCHOR_LINES = ["sprinkler_itm", "fire_alarm_itm"] as const;

type Operator = {
  operatorId: string;
  name: string;
  status: string;
  georgiaFacilityCount: number;
  cmsChainId: string | null;
  cmsChainFacilitiesNationwide: number | null;
};
export type ServiceFacility = {
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
type Link = { ccn: string; certifiedBeds: number | null };
type Dataset = { datasetId: string; retrievedOn: string; cmsModified: string };
type CoverageSlot = { searched: boolean; peopleFound: number; personaVerified: boolean; currentEmploymentVerified: boolean; channel: string };
type Coverage = { operatorId: string; status: string; slots?: Record<string, CoverageSlot>; roleChange?: { points: number; reason: string } };
export type PeopleCoverage = { roleChangeRule: string; retrievedOn: string; operators: Coverage[] };

export type TierInputs = {
  operators: Operator[];
  serviceability: { facilities: ServiceFacility[]; method: { timeSource: { retrievedOn: string } } };
  signals: { facilities: SignalFacility[] };
  web: { domains: Domain[]; jobs: Job[]; method: { retrievedOn: string } };
  manifest: { datasets: Dataset[] };
  links: { links: Link[] };
  people: PeopleCoverage | null;
};

export const loadInputs = async (): Promise<TierInputs> => ({
  operators: (await read<{ operators: Operator[] }>("operators.json")).operators,
  serviceability: await read("serviceability.json"),
  signals: await read("signals.json"),
  web: await read("web-signals.json"),
  manifest: await read("source-manifest.json"),
  links: await read("facility-operator-links.json"),
  people: await read<PeopleCoverage>("people-coverage.json").catch(() => null),
});

type Component = { points: number; max: number; input: string; source: string; proposal: boolean };

export const anchorState = (facility: ServiceFacility) => {
  const states = ANCHOR_LINES.map((line) => facility.lines[line]?.state);
  return states.includes("serviceable") ? "serviceable" : states.includes("conditional") ? "conditional" : "not_serviceable";
};
// Shortest drive to a branch able to do sprinkler or alarm work at this facility.
const anchorDriveMinutes = (facility: ServiceFacility) =>
  Math.min(
    ...ANCHOR_LINES.map((line) => facility.lines[line])
      .filter((line) => line && line.state !== "not_serviceable")
      .map((line) => line?.driveMinutes ?? Number.POSITIVE_INFINITY),
  );
const isRecentlyCited = (signal: SignalFacility) => signal.recentServiceLineCitations > 0;
const isRepeated = (signal: SignalFacility) => Boolean(signal.lines.sprinkler_itm?.repeated || signal.lines.fire_alarm_itm?.repeated);
const round = (value: number) => Math.round(value * 10) / 10;

// Annual value of one site under decision 0009. Out-of-footprint sites and sites without a bed count are worth zero.
export const siteAnnualValue = (beds: number | null, state: string, assumptions: ValueAssumptions) => {
  if (state === "not_serviceable" || beds === null) return 0;
  const factor = state === "conditional" ? assumptions.conditionalFactor : 1;
  return Math.round(assumptions.baseAnnualUsd * (beds / assumptions.baseBeds) ** assumptions.bedExponent * factor);
};

export function tierOperators(inputs: TierInputs, assumptions: ValueAssumptions = VALUE_ASSUMPTIONS) {
  const { operators, serviceability, signals, web, manifest } = inputs;
  const bedsDataset = manifest.datasets.find((dataset) => dataset.datasetId === "4pq5-n9py");
  const asOf = bedsDataset?.retrievedOn ?? "";
  const asOfTime = Date.parse(`${asOf}T00:00:00Z`);
  const monthsSince = (date: string) => (asOfTime - Date.parse(`${date}T00:00:00Z`)) / (1000 * 60 * 60 * 24 * 30.44);
  const decay = (age: number, horizon: number) => Math.max(0, Math.min(1, 1 - age / horizon));
  const bedSource = `4pq5-n9py.number_of_certified_beds (CMS modified ${bedsDataset?.cmsModified}, retrieved ${asOf}) via facility-operator-links.json`;

  const signalOf = new Map(signals.facilities.map((facility) => [facility.ccn, facility]));
  const domainOf = new Map(web.domains.map((domain) => [domain.operatorId, domain]));
  const jobsOf = new Map(web.jobs.map((job) => [job.operatorId, job]));
  const bedsOf = new Map(inputs.links.links.map((link) => [link.ccn, link.certifiedBeds]));
  const coverageOf = new Map((inputs.people?.operators ?? []).map((coverage) => [coverage.operatorId, coverage]));
  const peopleSource = inputs.people ? `people-coverage.json (Clay role-slot pass, ${inputs.people.retrievedOn})` : "none yet";

  // Statewide rates across every in-footprint facility, used as the prior for the citation shares.
  const footprintSignals = serviceability.facilities
    .filter((facility) => facility.operatorId !== null && anchorState(facility) !== "not_serviceable")
    .map((facility) => signalOf.get(facility.ccn))
    .filter((item): item is SignalFacility => Boolean(item));
  const recentRate = footprintSignals.filter(isRecentlyCited).length / footprintSignals.length;
  const repeatedRate = footprintSignals.filter(isRepeated).length / footprintSignals.length;
  const shrunkShare = (hits: number, n: number, rate: number) =>
    (hits + PARAMETERS.citationShrinkFacilities * rate) / (n + PARAMETERS.citationShrinkFacilities);

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
      points: youngestChange === null ? 0 : round(PARAMETERS.ownershipChange.max * decay(youngestChange, PARAMETERS.ownershipChange.decayMonths)),
      max: PARAMETERS.ownershipChange.max,
      input: youngestChange === null ? "no dated ownership or management change" : `latest ownership or management change ${round(youngestChange)} months before ${asOf}`,
      source: "y2hd-n93e.association_date; 4pq5-n9py.provider_changed_ownership_in_last_12_months",
      proposal: false,
    };

    const postings = jobsOf.get(operator.operatorId)?.postings ?? [];
    const postingAges = postings.map((posting) => (posting.date ? (asOfTime - Date.parse(posting.date)) / 86_400_000 : Number.NaN));
    const datedAges = postingAges.filter((age) => !Number.isNaN(age) && age >= 0);
    const hiringPoints =
      postings.length === 0
        ? 0
        : Math.max(
            PARAMETERS.hiring.undated,
            ...datedAges.map((age) => PARAMETERS.hiring.undated + (PARAMETERS.hiring.max - PARAMETERS.hiring.undated) * decay(age, PARAMETERS.hiring.decayDays)),
          );
    components.hiring = {
      points: round(hiringPoints),
      max: PARAMETERS.hiring.max,
      input: postings.length === 0 ? "no maintenance or facilities posting found" : `${postings.length} posting candidate(s), not confirmed open`,
      source: `web-signals.json jobs (Serper, ${web.method.retrievedOn})`,
      proposal: false,
    };

    const latestCitation = facilitySignals
      .flatMap((signal) => Object.values(signal.lines).map((line) => line.latestSurveyDate))
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1);
    components.citationTrigger = {
      points: latestCitation ? round(PARAMETERS.citationTrigger.max * decay(monthsSince(latestCitation), PARAMETERS.citationTrigger.decayMonths)) : 0,
      max: PARAMETERS.citationTrigger.max,
      input: latestCitation ? `latest service-line fire citation surveyed ${latestCitation}` : "no service-line fire citation",
      source: "ifjz-ge4w.survey_date via signals.json",
      proposal: false,
    };
    const coverage = coverageOf.get(operator.operatorId);
    const roleChangePoints = Math.min(PARAMETERS.roleChange.max, coverage?.roleChange?.points ?? 0);
    components.roleChange = {
      points: round(roleChangePoints),
      max: PARAMETERS.roleChange.max,
      input: !coverage
        ? "unknown: operator not yet covered by the people pass"
        : roleChangePoints > 0
          ? `${coverage.roleChange?.reason.replaceAll("_", " ")} (${inputs.people?.roleChangeRule.split(":")[0]})`
          : "no verified leader started within 24 months",
      source: coverage ? peopleSource : "none yet",
      proposal: false,
    };
    components.engagement = { points: 0, max: 0, input: "slot used by the approved citation trigger", source: "none", proposal: false };

    // Operational need and account context.
    const n = inFootprint.length;
    components.footprint = {
      points: round(PARAMETERS.footprint.max * (1 - Math.exp(-(n - 1) / PARAMETERS.footprint.scale))),
      max: PARAMETERS.footprint.max,
      input: `${n} Georgia facilities inside the footprint`,
      source: "serviceability.json (OSRM drive times, decision 0003 bands)",
      proposal: false,
    };
    components.regulatedEnvironment = {
      points: PARAMETERS.regulatedEnvironment.max,
      max: PARAMETERS.regulatedEnvironment.max,
      input: "CMS-certified nursing homes under federal life-safety surveys",
      source: "4pq5-n9py",
      proposal: false,
    };
    const recentHits = facilitySignals.filter(isRecentlyCited).length;
    const recentShare = shrunkShare(recentHits, n, recentRate);
    components.citationBreadth = {
      points: round(PARAMETERS.citationBreadth.max * recentShare),
      max: PARAMETERS.citationBreadth.max,
      input: `${recentHits} of ${n} footprint facilities cited for a service line since 2025; ${Math.round(recentShare * 100)}% after pulling toward the ${Math.round(recentRate * 100)}% statewide rate`,
      source: "ifjz-ge4w via signals.json",
      proposal: false,
    };
    const repeatedHits = facilitySignals.filter(isRepeated).length;
    const repeatedShare = shrunkShare(repeatedHits, n, repeatedRate);
    components.citationRepetition = {
      points: round(PARAMETERS.citationRepetition.max * repeatedShare),
      max: PARAMETERS.citationRepetition.max,
      input: `${repeatedHits} of ${n} footprint facilities with sprinkler or alarm cited on more than one survey; ${Math.round(repeatedShare * 100)}% after pulling toward the ${Math.round(repeatedRate * 100)}% statewide rate`,
      source: "ifjz-ge4w via signals.json",
      proposal: false,
    };

    // Data confidence.
    const domain = domainOf.get(operator.operatorId);
    components.domain = {
      points: domain?.confidence === "name_match" ? PARAMETERS.domain.nameMatch : domain?.confidence === "word_match" ? PARAMETERS.domain.wordMatch : 0,
      max: 2,
      input: domain?.domain ? `${domain.domain} (${domain.confidence})` : "no confirmed domain",
      source: `web-signals.json domains (Serper, ${web.method.retrievedOn})`,
      proposal: false,
    };
    components.geography = {
      points: serviceableCount > 0 ? PARAMETERS.geography.serviceable : PARAMETERS.geography.conditional,
      max: 2,
      input: serviceableCount > 0 ? `${serviceableCount} facilities within 90 minutes` : "conditional only: 90 to 120 minutes, needs manager approval",
      source: `serviceability.json (OSRM, ${serviceability.method.timeSource.retrievedOn})`,
      proposal: false,
    };
    components.locationProvenance = {
      points: operator.status === "resolved" ? PARAMETERS.locationProvenance.resolved : PARAMETERS.locationProvenance.provisional,
      max: 2,
      input: operator.status === "resolved" ? "facility list resolved from CMS" : "provisional: a facility awaits manual review",
      source: "operators.json",
      proposal: false,
    };
    const slots = Object.values(coverage?.slots ?? {});
    const personaVerified = slots.some((slot) => slot.personaVerified && slot.currentEmploymentVerified);
    const channelVerified = slots.some((slot) => slot.channel === "verified");
    components.personaAndChannel = {
      points: (personaVerified ? PARAMETERS.personaVerified : 0) + (channelVerified ? PARAMETERS.channelVerified : 0),
      max: PARAMETERS.personaVerified + PARAMETERS.channelVerified,
      input: !coverage
        ? "unknown: operator not yet covered by the people pass"
        : `${personaVerified ? "a persona and current employment verified" : "no persona verified"}; ${channelVerified ? "a channel verified" : "channel not checked"}`,
      source: coverage ? peopleSource : "none yet",
      proposal: false,
    };

    const score = round(Object.values(components).reduce((sum, component) => sum + component.points, 0));
    const band = score >= PARAMETERS.bands.A ? "A" : score >= PARAMETERS.bands.B ? "B" : score >= PARAMETERS.bands.C ? "C" : "Watch";

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
    if (components.roleChange.points > 0) reasons.push("a verified leader started there recently");
    const joined = reasons.length > 1 ? `${reasons.slice(0, -1).join(", ")}, and ${reasons.at(-1)}` : reasons[0];
    const explanation = `Band ${band} because ${joined}.`;

    // Account value, decision 0009. Computed from the fixed band; nothing below feeds the score.
    const sites = facilities.map((facility) => {
      const state = anchorState(facility);
      const beds = bedsOf.get(facility.ccn) ?? null;
      return {
        ccn: facility.ccn,
        certifiedBeds: beds,
        bedSource,
        anchorState: state,
        distanceFactor: state === "serviceable" ? 1 : state === "conditional" ? assumptions.conditionalFactor : 0,
        anchorDriveMinutes: state === "not_serviceable" ? null : anchorDriveMinutes(facility),
        annualUsd: siteAnnualValue(beds, state, assumptions),
        assumptionsVersion: assumptions.version,
      };
    });
    const valuedSites = sites.filter((site) => site.anchorState !== "not_serviceable");
    const annualUsd = sites.reduce((sum, site) => sum + site.annualUsd, 0);
    const fiveYearUsd = Math.round(annualUsd * assumptions.fiveYearMultiple);
    const largestSite = valuedSites.reduce((best, site) => (site.annualUsd > best.annualUsd ? site : best));
    const landingUsd = Math.round(largestSite.annualUsd * assumptions.fiveYearMultiple);
    const valueBand = fiveYearUsd >= assumptions.bands.Large ? "Large" : fiveYearUsd >= assumptions.bands.Mid ? "Mid" : "Small";
    const sitesWithoutBeds = valuedSites.filter((site) => site.certifiedBeds === null).length;
    const footprintBeds = valuedSites.reduce((sum, site) => sum + (site.certifiedBeds ?? 0), 0);

    const singleSite = facilities.length === 1;
    const rule = valueBand === "Small" && singleSite && (band === "C" || band === "Watch");
    const farthestDrive = Math.max(...valuedSites.map((site) => site.anchorDriveMinutes ?? Number.POSITIVE_INFINITY));
    const nearTheJaws = {
      applies: rule,
      repEligible: !rule || farthestDrive <= assumptions.nearTheJawsMinutes,
      input: rule
        ? `Small single-site operator in band ${band}; site ${farthestDrive} minutes from a capable branch against a ${assumptions.nearTheJawsMinutes}-minute radius`
        : "rule applies only to Small single-site operators in band C or Watch",
      source: `serviceability.json sprinkler and alarm drive minutes (OSRM, ${serviceability.method.timeSource.retrievedOn})`,
      assumptionsVersion: assumptions.version,
    };

    const value = {
      assumptionsVersion: assumptions.version,
      band: valueBand,
      annualUsd,
      fiveYearUsd,
      landingUsd,
      landingSite: largestSite.ccn,
      input: `${valuedSites.length} footprint sites with ${footprintBeds} certified beds${sitesWithoutBeds > 0 ? `; ${sitesWithoutBeds} site(s) without a bed count valued at zero` : ""}`,
      bedSource,
      sources: [bedSource, `serviceability.json (OSRM, ${serviceability.method.timeSource.retrievedOn})`, assumptions.decision],
      nearTheJaws,
      // Observable effort proxies, recorded and deliberately unscored until win rate and cycle are measured.
      effort: {
        scored: false,
        centralProcurementChain: { value: operator.cmsChainId !== null, source: "4pq5-n9py.chain_id via operators.json" },
        nationalIncumbentVendor: { value: "unknown", source: "not yet collected" },
      },
      sites,
    };

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
      value,
    };
  });

  // The queue orders by priority band first and by five-year value within a band (decision 0009).
  const bandRank = { A: 0, B: 1, C: 2, Watch: 3 } as Record<string, number>;
  const eligible = results
    .filter((result) => result.eligible)
    .sort(
      (a, b) =>
        (bandRank[a.band ?? ""] ?? 4) - (bandRank[b.band ?? ""] ?? 4) ||
        (b.value?.fiveYearUsd ?? 0) - (a.value?.fiveYearUsd ?? 0) ||
        (b.score ?? 0) - (a.score ?? 0) ||
        a.operatorId.localeCompare(b.operatorId),
    );
  const ineligible = results.filter((result) => !result.eligible).sort((a, b) => a.operatorId.localeCompare(b.operatorId));
  return { asOf, eligible, ineligible };
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { asOf, eligible, ineligible } = tierOperators(await loadInputs());

  await writeFile(
    resolve(sampleRoot, "tiers.json"),
    `${JSON.stringify(
      {
        method: {
          script: "scripts/georgia-sample/tier.ts",
          contract: CONTRACT,
          parametersVersion: PARAMETERS_VERSION,
          status: "approved by the user on 2026-10-20 (tiering proposal 2)",
          asOf,
          parameters: PARAMETERS,
          valueAssumptions: VALUE_ASSUMPTIONS,
          notes: [
            "Bands order work and never grant eligibility; a manager may select any eligible operator.",
            "People-based inputs (role change, persona, channel) come from people-coverage.json; an operator the Stage 6 pass has not covered scores them zero as unknown. Channel verification has not run, so no operator has earned the two channel points yet.",
            "Hard gate: at least one facility serviceable or conditional for sprinkler or alarm work.",
            "Value (decision 0009) sits beside the score and never changes a score or band; its prices are assumptions, not market evidence.",
            "Operators are ordered by priority band, then five-year value within a band.",
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
  const valueBands = Object.fromEntries(["Large", "Mid", "Small"].map((band) => [band, eligible.filter((result) => result.value?.band === band).length]));
  const scores = eligible.map((result) => result.score ?? 0).sort((a, b) => b - a);
  const byValue = [...eligible].sort((a, b) => (b.value?.fiveYearUsd ?? 0) - (a.value?.fiveYearUsd ?? 0));
  process.stdout.write(
    `${JSON.stringify(
      {
        eligible: eligible.length,
        outsideFootprint: ineligible.length,
        bands: bandCounts,
        scoreRange: [Math.min(...scores), Math.max(...scores)],
        median: scores[Math.floor(scores.length / 2)],
        valueBands,
        annualUsdTotal: eligible.reduce((sum, result) => sum + (result.value?.annualUsd ?? 0), 0),
        nearTheJaws: {
          applies: eligible.filter((result) => result.value?.nearTheJaws.applies).length,
          repEligible: eligible.filter((result) => result.value?.nearTheJaws.applies && result.value.nearTheJaws.repEligible).length,
        },
        topFiveYear: byValue.slice(0, 10).map((result) => ({
          name: result.name,
          band: result.band,
          sites: result.value?.sites.filter((site) => site.anchorState !== "not_serviceable").length,
          annualUsd: result.value?.annualUsd,
          fiveYearUsd: result.value?.fiveYearUsd,
          landingUsd: result.value?.landingUsd,
          valueBand: result.value?.band,
        })),
      },
      null,
      2,
    )}\n`,
  );
}
