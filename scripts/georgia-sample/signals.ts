// Stage 4 (free public-data part) of docs/research/georgia-senior-living-sample-plan.md.
// Maps CMS fire safety citations to Anchorpoint service lines, keeps severity, recency,
// repetition, and correction status as evidence, and adds ownership association dates as the
// change signal. Rolls both up to operators. Serper domain and job-posting lookups are a
// separate step that needs an API key.
// The ownership file names individuals; only dates and owner types leave it, never names.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");

type Row = Record<string, string>;
type ServiceLine = "sprinkler_itm" | "fire_alarm_itm" | "extinguisher" | "kitchen_hood" | "emergency_lighting";
type WorkKind = "itm" | "install_or_repair";

// Life Safety Code K-tags mapped to decision 0003's catalog. "itm" tags cite the inspection,
// testing, and maintenance program itself; "install_or_repair" tags cite missing or faulty
// equipment, which is deficiency-repair or retrofit project work. Tags for doors, barriers,
// electrical, generators, and medical gas map to no catalog line and are not counted.
const TAG_MAP: Record<string, { line: ServiceLine; kind: WorkKind }> = {
  "K-0353": { line: "sprinkler_itm", kind: "itm" },
  "K-0352": { line: "sprinkler_itm", kind: "itm" },
  "K-0351": { line: "sprinkler_itm", kind: "install_or_repair" },
  "K-0345": { line: "fire_alarm_itm", kind: "itm" },
  "K-0341": { line: "fire_alarm_itm", kind: "install_or_repair" },
  "K-0342": { line: "fire_alarm_itm", kind: "install_or_repair" },
  "K-0343": { line: "fire_alarm_itm", kind: "install_or_repair" },
  "K-0347": { line: "fire_alarm_itm", kind: "install_or_repair" },
  "K-0355": { line: "extinguisher", kind: "itm" },
  "K-0324": { line: "kitchen_hood", kind: "itm" },
  "K-0291": { line: "emergency_lighting", kind: "itm" },
  "K-0293": { line: "emergency_lighting", kind: "install_or_repair" },
  "K-0281": { line: "emergency_lighting", kind: "install_or_repair" },
};

const SERVICE_LINES: ServiceLine[] = ["sprinkler_itm", "fire_alarm_itm", "extinguisher", "kitchen_hood", "emergency_lighting"];
const RECENT_SINCE = "2025-01-01";
const OWNERSHIP_CHANGE_MONTHS = 24;
const CORRECTED = "Deficient, Provider has date of correction";
// Individuals with operational or managerial control are mostly administrators whose turnover
// is not an ownership change, so only organizations count for management changes.
const OWNERSHIP_ROLES = /OWNERSHIP INTEREST|PARTNERSHIP INTEREST/;
const MANAGEMENT_ROLE = "OPERATIONAL/MANAGERIAL CONTROL";

const manifest = JSON.parse(await readFile(resolve(sampleRoot, "source-manifest.json"), "utf8")) as {
  datasets: { datasetId: string; retrievedOn: string; cmsModified: string; sha256: string }[];
};
const readRaw = async (id: string) => JSON.parse(await readFile(resolve(sampleRoot, "raw/cms", `${id}.json`), "utf8")) as Row[];
const citations = await readRaw("ifjz-ge4w");
const ownership = await readRaw("y2hd-n93e");
const providers = await readRaw("4pq5-n9py");
const lookup = await readRaw("tagd-9999");
const { links } = JSON.parse(await readFile(resolve(sampleRoot, "facility-operator-links.json"), "utf8")) as {
  links: { ccn: string; operatorId: string }[];
};
const operatorOf = new Map(links.map((link) => [link.ccn, link.operatorId]));

// Every mapped tag must exist in CMS's citation code look-up; its wording is recorded.
const tagDescriptions = new Map(lookup.map((row) => [row.deficiency_prefix_and_number ?? "", row]));
const tagMap = Object.entries(TAG_MAP).map(([tag, mapping]) => {
  const row = tagDescriptions.get(tag);
  if (!row) throw new Error(`${tag} is not in the CMS Citation Code Look-up (tagd-9999)`);
  return { tag, ...mapping, cmsDescription: row.deficiency_description ?? "", cmsCategory: row.deficiency_category ?? "" };
});

const retrievedOn = manifest.datasets.find((dataset) => dataset.datasetId === "y2hd-n93e")?.retrievedOn ?? "";
const changeSince = (() => {
  const date = new Date(`${retrievedOn}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - OWNERSHIP_CHANGE_MONTHS);
  return date.toISOString().slice(0, 10);
})();

// "since 08/01/2014" -> "2014-08-01"
function associationDate(value: string): string | null {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

type Evidence = { tag: string; surveyDate: string; severity: string; corrected: boolean; kind: WorkKind };
type LineSignal = {
  citations: number;
  recentCitations: number;
  surveysCited: number;
  repeated: boolean;
  maxSeverity: string | null;
  uncorrected: number;
  latestSurveyDate: string | null;
  evidence: Evidence[];
};

const emptyLine = (): LineSignal => ({
  citations: 0,
  recentCitations: 0,
  surveysCited: 0,
  repeated: false,
  maxSeverity: null,
  uncorrected: 0,
  latestSurveyDate: null,
  evidence: [],
});

const facilities = new Map(
  providers.map((provider) => [
    provider.cms_certification_number_ccn ?? "",
    {
      ccn: provider.cms_certification_number_ccn ?? "",
      operatorId: operatorOf.get(provider.cms_certification_number_ccn ?? "") ?? null,
      lines: Object.fromEntries(SERVICE_LINES.map((line) => [line, emptyLine()])) as Record<ServiceLine, LineSignal>,
      allFireCitations: 0,
      cmsChangedOwnershipLast12Months: provider.provider_changed_ownership_in_last_12_months === "Y",
      latestOwnershipAssociation: null as string | null,
      ownershipChangesSince: 0,
      managementOrganizationChangesSince: 0,
    },
  ]),
);

for (const citation of citations) {
  const facility = facilities.get(citation.cms_certification_number_ccn ?? "");
  if (!facility) continue;
  facility.allFireCitations += 1;
  const tag = `${citation.deficiency_prefix}-${citation.deficiency_tag_number}`;
  const mapping = TAG_MAP[tag];
  if (!mapping) continue;
  const signal = facility.lines[mapping.line];
  const surveyDate = citation.survey_date ?? "";
  const severity = citation.scope_severity_code ?? "";
  const corrected = citation.deficiency_corrected === CORRECTED;
  signal.citations += 1;
  if (surveyDate >= RECENT_SINCE) signal.recentCitations += 1;
  if (!corrected) signal.uncorrected += 1;
  if (!signal.maxSeverity || severity > signal.maxSeverity) signal.maxSeverity = severity;
  if (!signal.latestSurveyDate || surveyDate > signal.latestSurveyDate) signal.latestSurveyDate = surveyDate;
  signal.evidence.push({ tag, surveyDate, severity, corrected, kind: mapping.kind });
}

for (const facility of facilities.values()) {
  for (const signal of Object.values(facility.lines)) {
    signal.evidence.sort((a, b) => b.surveyDate.localeCompare(a.surveyDate) || a.tag.localeCompare(b.tag));
    signal.surveysCited = new Set(signal.evidence.map((item) => item.surveyDate)).size;
    signal.repeated = signal.surveysCited > 1;
  }
}

for (const row of ownership) {
  const facility = facilities.get(row.cms_certification_number_ccn ?? "");
  const role = row.role_played_by_owner_or_manager_in_facility ?? "";
  const date = associationDate(row.association_date ?? "");
  if (!facility || !date) continue;
  if (OWNERSHIP_ROLES.test(role)) {
    if (!facility.latestOwnershipAssociation || date > facility.latestOwnershipAssociation) facility.latestOwnershipAssociation = date;
    if (date >= changeSince) facility.ownershipChangesSince += 1;
  } else if (role === MANAGEMENT_ROLE && row.owner_type === "Organization" && date >= changeSince) {
    facility.managementOrganizationChangesSince += 1;
  }
}

const facilityList = [...facilities.values()]
  .map((facility) => ({
    ...facility,
    serviceLineCitations: SERVICE_LINES.reduce((sum, line) => sum + facility.lines[line].citations, 0),
    recentServiceLineCitations: SERVICE_LINES.reduce((sum, line) => sum + facility.lines[line].recentCitations, 0),
    citedLines: SERVICE_LINES.filter((line) => facility.lines[line].citations > 0),
    ownershipChangeSignal: facility.ownershipChangesSince > 0 || facility.cmsChangedOwnershipLast12Months,
    managementChangeSignal: facility.managementOrganizationChangesSince > 0,
  }))
  .sort((a, b) => a.ccn.localeCompare(b.ccn));

type OperatorSignal = {
  operatorId: string;
  facilities: number;
  facilitiesWithServiceLineCitations: number;
  serviceLineCitations: number;
  recentServiceLineCitations: number;
  byLine: Record<ServiceLine, { citations: number; recentCitations: number; facilitiesRepeated: number; uncorrected: number; maxSeverity: string | null }>;
  facilitiesWithOwnershipChange: number;
  facilitiesWithManagementChange: number;
  latestOwnershipAssociation: string | null;
};

const operators = new Map<string, OperatorSignal>();
for (const facility of facilityList) {
  if (!facility.operatorId) continue;
  const entry =
    operators.get(facility.operatorId) ??
    ({
      operatorId: facility.operatorId,
      facilities: 0,
      facilitiesWithServiceLineCitations: 0,
      serviceLineCitations: 0,
      recentServiceLineCitations: 0,
      byLine: Object.fromEntries(
        SERVICE_LINES.map((line) => [line, { citations: 0, recentCitations: 0, facilitiesRepeated: 0, uncorrected: 0, maxSeverity: null }]),
      ),
      facilitiesWithOwnershipChange: 0,
      facilitiesWithManagementChange: 0,
      latestOwnershipAssociation: null,
    } as OperatorSignal);
  entry.facilities += 1;
  if (facility.serviceLineCitations > 0) entry.facilitiesWithServiceLineCitations += 1;
  entry.serviceLineCitations += facility.serviceLineCitations;
  entry.recentServiceLineCitations += facility.recentServiceLineCitations;
  for (const line of SERVICE_LINES) {
    const source = facility.lines[line];
    const target = entry.byLine[line];
    target.citations += source.citations;
    target.recentCitations += source.recentCitations;
    target.uncorrected += source.uncorrected;
    if (source.repeated) target.facilitiesRepeated += 1;
    if (source.maxSeverity && (!target.maxSeverity || source.maxSeverity > target.maxSeverity)) target.maxSeverity = source.maxSeverity;
  }
  if (facility.ownershipChangeSignal) entry.facilitiesWithOwnershipChange += 1;
  if (facility.managementChangeSignal) entry.facilitiesWithManagementChange += 1;
  if (
    facility.latestOwnershipAssociation &&
    (!entry.latestOwnershipAssociation || facility.latestOwnershipAssociation > entry.latestOwnershipAssociation)
  ) {
    entry.latestOwnershipAssociation = facility.latestOwnershipAssociation;
  }
  operators.set(facility.operatorId, entry);
}
const operatorList = [...operators.values()].sort((a, b) => a.operatorId.localeCompare(b.operatorId));

const sources = ["ifjz-ge4w", "y2hd-n93e", "4pq5-n9py", "tagd-9999"].map((id) => {
  const entry = manifest.datasets.find((dataset) => dataset.datasetId === id);
  return { datasetId: id, cmsModified: entry?.cmsModified ?? null, retrievedOn: entry?.retrievedOn ?? null, sha256: entry?.sha256 ?? null };
});
const method = {
  script: "scripts/georgia-sample/signals.ts",
  sources,
  tagMap,
  recentSince: RECENT_SINCE,
  severityScale: "CMS scope and severity code, A (least) to L (most); D to F is no actual harm with potential for more than minimal harm",
  repeated: "the same service line was cited on more than one survey date",
  corrected: `deficiency_corrected = "${CORRECTED}"`,
  ownershipChange: `an ownership or partnership interest association dated on or after ${changeSince} (${OWNERSHIP_CHANGE_MONTHS} months before retrieval), or the CMS change-of-ownership flag`,
  managementChange: `an organization associated with operational or managerial control on or after ${changeSince}; individual managers are excluded as routine staff turnover`,
  personalData: "owner names are never read into the output; only dates and roles are used",
};
await writeFile(
  resolve(sampleRoot, "signals.json"),
  `${JSON.stringify({ method, operators: operatorList, facilities: facilityList }, null, 2)}\n`,
  "utf8",
);

const count = <T>(items: T[], test: (item: T) => boolean) => items.filter(test).length;
process.stdout.write(
  `${JSON.stringify(
    {
      fireCitations: citations.length,
      serviceLineCitations: facilityList.reduce((sum, facility) => sum + facility.serviceLineCitations, 0),
      byLine: Object.fromEntries(
        SERVICE_LINES.map((line) => [
          line,
          {
            citations: facilityList.reduce((sum, facility) => sum + facility.lines[line].citations, 0),
            recent: facilityList.reduce((sum, facility) => sum + facility.lines[line].recentCitations, 0),
            facilities: count(facilityList, (facility) => facility.lines[line].citations > 0),
            facilitiesRepeated: count(facilityList, (facility) => facility.lines[line].repeated),
          },
        ]),
      ),
      facilitiesWithServiceLineCitations: count(facilityList, (facility) => facility.serviceLineCitations > 0),
      facilitiesWithRecentServiceLineCitations: count(facilityList, (facility) => facility.recentServiceLineCitations > 0),
      uncorrectedServiceLineCitations: facilityList.reduce(
        (sum, facility) => sum + SERVICE_LINES.reduce((inner, line) => inner + facility.lines[line].uncorrected, 0),
        0,
      ),
      facilitiesWithOwnershipChange: count(facilityList, (facility) => facility.ownershipChangeSignal),
      facilitiesWithManagementChange: count(facilityList, (facility) => facility.managementChangeSignal),
      operatorsWithServiceLineCitations: count(operatorList, (operator) => operator.serviceLineCitations > 0),
      operatorsWithOwnershipChange: count(operatorList, (operator) => operator.facilitiesWithOwnershipChange > 0),
      operatorsWithManagementChange: count(operatorList, (operator) => operator.facilitiesWithManagementChange > 0),
    },
    null,
    2,
  )}\n`,
);
