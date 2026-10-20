// Stage 6 of docs/research/georgia-senior-living-sample-plan.md, designed in
// docs/research/georgia-clay-people-pass.md.
// Writes the Clay input tables for the people pass: one operator table for multi-site operators
// and two site tables (band A, then bands B and C, each under the free plan's 200-row limit).
// Inputs are committed business facts only. Output goes to the gitignored private folder because
// the Clay tables built from it will hold people.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const outDir = resolve(sampleRoot, "private/clay/input");

type LineState = { state: string; driveMinutes: number | null; latestSurveyDate?: string | null };
type TierOperator = { operatorId: string; name: string; eligible: boolean; band: string | null; score: number; footprintFacilities: number; identityStatus: string };
type Operator = { operatorId: string; georgiaFacilityCount: number; cmsChainId: string | null };
type Link = { ccn: string; facilityName: string; city: string; zip: string; county: string; certifiedBeds: number; operatorId: string };
type ServiceFacility = { ccn: string; operatorId: string | null; lines: Record<string, LineState> };
type SignalFacility = { ccn: string; lines: Record<string, { latestSurveyDate: string | null }> };
type Domain = { operatorId: string; domain: string | null; confidence: string };

const read = async <T>(name: string) => JSON.parse(await readFile(resolve(sampleRoot, name), "utf8")) as T;
const { operators: tiers } = await read<{ operators: TierOperator[] }>("tiers.json");
const { operators } = await read<{ operators: Operator[] }>("operators.json");
const { links } = await read<{ links: Link[] }>("facility-operator-links.json");
const serviceability = await read<{ facilities: ServiceFacility[] }>("serviceability.json");
const signals = await read<{ facilities: SignalFacility[] }>("signals.json");
const { domains } = await read<{ domains: Domain[] }>("web-signals.json");

const BAND_ORDER = ["A", "B", "C"];
const operatorOf = new Map(operators.map((operator) => [operator.operatorId, operator]));
const linkOf = new Map(links.map((link) => [link.ccn, link]));
const signalOf = new Map(signals.facilities.map((facility) => [facility.ccn, facility]));
const domainOf = new Map(domains.map((domain) => [domain.operatorId, domain]));

// Same footprint rule as tier.ts: serviceable or conditional for sprinkler or alarm work.
const anchorState = (facility: ServiceFacility) => {
  const states = [facility.lines.sprinkler_itm?.state, facility.lines.fire_alarm_itm?.state];
  return states.includes("serviceable") ? "serviceable" : states.includes("conditional") ? "conditional" : "not_serviceable";
};
const anchorMinutes = (facility: ServiceFacility) =>
  Math.min(...[facility.lines.sprinkler_itm?.driveMinutes, facility.lines.fire_alarm_itm?.driveMinutes].filter((value): value is number => typeof value === "number"));
const latestCitation = (ccn: string) =>
  Object.values(signalOf.get(ccn)?.lines ?? {})
    .map((line) => line.latestSurveyDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? "";

const inScope = tiers
  .filter((operator) => operator.eligible && operator.band && BAND_ORDER.includes(operator.band))
  .sort((a, b) => BAND_ORDER.indexOf(a.band!) - BAND_ORDER.indexOf(b.band!) || b.score - a.score);

const csv = (rows: Record<string, string | number>[]) => {
  const columns = Object.keys(rows[0]);
  const cell = (value: string | number) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
  return [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\n") + "\n";
};

const operatorRows: Record<string, string | number>[] = [];
const siteRows: Record<string, string | number>[] = [];
for (const [index, operator] of inScope.entries()) {
  const domain = domainOf.get(operator.operatorId);
  const confirmedDomain = domain?.domain && domain.confidence !== "none" ? domain.domain : "";
  const multiSite = operator.footprintFacilities > 1;
  if (multiSite) {
    operatorRows.push({
      run_order: index + 1,
      operator_id: operator.operatorId,
      band: operator.band!,
      score: operator.score,
      operator_name: operator.name,
      domain: confirmedDomain,
      domain_confidence: confirmedDomain ? domain!.confidence : "none",
      footprint_facilities: operator.footprintFacilities,
      georgia_facility_count: operatorOf.get(operator.operatorId)?.georgiaFacilityCount ?? "",
      identity_status: operator.identityStatus,
    });
  }
  const sites = serviceability.facilities
    .filter((facility) => facility.operatorId === operator.operatorId && anchorState(facility) !== "not_serviceable")
    .sort((a, b) => latestCitation(b.ccn).localeCompare(latestCitation(a.ccn)) || anchorMinutes(a) - anchorMinutes(b));
  for (const [rank, facility] of sites.entries()) {
    const link = linkOf.get(facility.ccn)!;
    siteRows.push({
      run_order: index + 1,
      site_rank: rank + 1,
      wave: 1,
      ccn: facility.ccn,
      operator_id: operator.operatorId,
      band: operator.band!,
      facility_name: link.facilityName,
      city: link.city,
      zip: link.zip,
      county: link.county,
      certified_beds: link.certifiedBeds,
      operator_name: operator.name,
      operator_domain: confirmedDomain,
      // Single-site staff usually list the facility, not a parent, as employer.
      search_company: multiSite ? confirmedDomain || operator.name : link.facilityName,
      latest_service_line_citation: latestCitation(facility.ccn),
      anchor_drive_minutes: anchorMinutes(facility),
    });
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "operators.csv"), csv(operatorRows));
await writeFile(resolve(outDir, "sites-band-a.csv"), csv(siteRows.filter((row) => row.band === "A")));
await writeFile(resolve(outDir, "sites-band-bc.csv"), csv(siteRows.filter((row) => row.band !== "A")));
console.log(
  `Clay inputs: ${operatorRows.length} operator rows, ${siteRows.filter((row) => row.band === "A").length} band A site rows, ` +
    `${siteRows.filter((row) => row.band !== "A").length} band B and C site rows, from ${inScope.length} in-scope operators.`,
);
