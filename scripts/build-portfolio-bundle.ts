// Portfolio bundle (docs/product/finish-plan.md, agent task 4). Copies the Georgia sample
// outputs into artifacts/portfolio/ with a provenance wrapper, summarizes the tier bands,
// and writes one end-to-end lineage trace for Tift Regional (trading as Southwell) from the
// raw CMS rows through serviceability, signals, tiering, the Clay round trip, and Attio.
//
//   npm run portfolio:bundle
//
// Reads only files already on disk; it calls no API and needs no database. Private inputs
// (raw CMS rows and the Clay CSVs) are gitignored and may name real people, so the trace
// are reduced to role slot and persona status; no name, title, link, email, or phone is copied.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { planWriteback, type AttioState } from "../packages/connectors/src/attio/writeback.ts";
import { expandClayTable, mapClayRows, type RoleSlot } from "./clay-attio-mapping.ts";
import { parseCsv } from "./georgia-sample/clay-reduce.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const sampleDir = "data/georgia-sample";
const outDir = resolve(projectRoot, "artifacts/portfolio");
const generatedAt = new Date().toISOString();

type Json = Record<string, unknown>;
const exists = async (file: string) => readFile(resolve(projectRoot, file)).then(() => true, () => false);
const readJson = async <T = Json>(file: string) => JSON.parse(await readFile(resolve(projectRoot, file), "utf8")) as T;
const readJsonIfPresent = async <T = Json>(file: string) => ((await exists(file)) ? readJson<T>(file) : null);
const writeJson = async (name: string, value: unknown) => writeFile(resolve(outDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
const wrap = (source: string, data: unknown) => ({ generatedAt, source, data });

// Fields that are, or may hold, a phone number or an email address. Never copied.
const CONTACT_FIELDS = new Set(["telephone_number", "work_email", "mobile_phone", "Mobile Phone", "Mobile Phone Number", "email"]);
const stripContact = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !CONTACT_FIELDS.has(key) && !/phone|email/i.test(key)));
// CMS ownership rows name individual owners and officers; only organizations keep their name.
const withholdIndividuals = (row: Record<string, unknown>) =>
  row["owner_type"] === "Individual" ? { ...row, owner_name: "individual (name withheld)" } : row;

// ---- operator lookup ----------------------------------------------------

interface Operator { operatorId: string; name: string; facilityCcns: string[]; [key: string]: unknown }
const operatorsFile = await readJson<{ generatedFrom: Json; operators: Operator[] }>(`${sampleDir}/operators.json`);

// ---- straight copies ----------------------------------------------------

await mkdir(outDir, { recursive: true });
const copies = ["tiers.json", "serviceability.json", "people-coverage.json", "signals.json"] as const;
const copied: Record<string, Json> = {};
for (const name of copies) {
  copied[name] = await readJson(`${sampleDir}/${name}`);
  await writeJson(name, wrap(`${sampleDir}/${name}`, copied[name]));
}

// ---- tier summary -------------------------------------------------------

interface TierRecord {
  operatorId: string; name: string; eligible: boolean; gate: string | null; band: string | null; score: number | null;
  explanation: string | null; value?: { fiveYearUsd?: number; band?: string };
}
const tiers = copied["tiers.json"] as unknown as { method: Json; operators: TierRecord[]; outsideFootprint: TierRecord[] };
const allTiered = [...tiers.operators, ...tiers.outsideFootprint];
const countBy = (rows: TierRecord[], key: (row: TierRecord) => string) => {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1;
  return counts;
};
const tierSummary = {
  generatedAt,
  source: `${sampleDir}/tiers.json`,
  method: { contract: tiers.method["contract"], parametersVersion: tiers.method["parametersVersion"], status: tiers.method["status"], asOf: tiers.method["asOf"] },
  operators: allTiered.length,
  bands: countBy(allTiered.filter((row) => row.band), (row) => row.band as string),
  eligibility: {
    eligible: allTiered.filter((row) => row.eligible).length,
    outsideFootprint: allTiered.filter((row) => !row.eligible).length,
    gates: countBy(allTiered.filter((row) => !row.eligible), (row) => row.gate ?? "unstated"),
  },
  topA: allTiered
    .filter((row) => row.band === "A")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((row) => ({ operatorId: row.operatorId, name: row.name, score: row.score, explanation: row.explanation })),
  note: "Bands order work and never grant eligibility. People-based inputs were unknown when these scores were set, so the maximum was 65 of 100.",
};
await writeJson("tier-summary.json", tierSummary);

// ---- lineage traces -----------------------------------------------------

const manifest = await readJson<{ datasets: { datasetId: string; rawFile: string; [key: string]: unknown }[] }>(`${sampleDir}/source-manifest.json`);
const rawRows: Record<string, Record<string, unknown>[] | null> = {};
for (const dataset of manifest.datasets) if (dataset.datasetId !== "tagd-9999") rawRows[dataset.datasetId] = await readJsonIfPresent<Record<string, unknown>[]>(dataset.rawFile);

interface TraceSpec { match: RegExp; file: string; tradingAs: string; caveat: string }

async function buildLineage(spec: TraceSpec) {
const target = operatorsFile.operators.find((op) => spec.match.test(op.name));
if (!target) throw new Error(`No operator in operators.json matches ${spec.match}`);
const ID = target.operatorId;
const ccns = new Set(target.facilityCcns);
const byOperator = (row: { operatorId?: string | null }) => row.operatorId === ID;
const byCcn = (row: { ccn?: string }) => row.ccn !== undefined && ccns.has(row.ccn);
const step = (file: string, what: string, data: unknown) => ({ file, what, data });
const trace: { step: string; file: string; what: string; data: unknown }[] = [];
const missing: string[] = [];
const add = (name: string, file: string, what: string, data: unknown) => {
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) missing.push(`${name}: nothing for ${target.name} in ${file}`);
  trace.push({ step: name, ...step(file, what, data) });
};

// 1. Source manifest and raw CMS rows (raw rows are gitignored; the manifest is committed).
add("source-manifest", `${sampleDir}/source-manifest.json`, "The CMS datasets pulled on 2026-10-19 with their hashes", manifest.datasets);
for (const dataset of manifest.datasets) {
  if (dataset.datasetId === "tagd-9999") continue; // national lookup table, not per facility
  const rows = rawRows[dataset.datasetId] ?? null;
  if (!rows) { missing.push(`raw rows: ${dataset.rawFile} is not on this machine`); continue; }
  const hits = rows.filter((row) => ccns.has(String(row["cms_certification_number_ccn"]))).map(stripContact).map(withholdIndividuals);
  add(`raw-cms-${dataset.datasetId}`, dataset.rawFile, `Raw ${dataset["title"]} rows for CCN ${[...ccns].join(", ")} (facility phone number and individual owner names removed)`, hits);
}

// 2. Operator resolution, facilities, and links.
add("operator", `${sampleDir}/operators.json`, "The operator record resolved from the CMS legal business name", target);
const links = await readJson<{ links: { ccn: string }[] }>(`${sampleDir}/facility-operator-links.json`);
add("facility-links", `${sampleDir}/facility-operator-links.json`, "Facility to operator link with the CMS field it rests on", links.links.filter(byCcn));
const review = await readJson<{ reviewCases: { operatorId?: string }[] }>(`${sampleDir}/operator-review.json`);
trace.push({ step: "operator-review", ...step(`${sampleDir}/operator-review.json`, "Review cases raised during resolution (none expected for a clean legal-name match)", review.reviewCases.filter(byOperator)) });

// 3. Serviceability.
const serviceability = copied["serviceability.json"] as unknown as { operators: { operatorId: string }[]; facilities: { ccn: string }[] };
add("serviceability-operator", `${sampleDir}/serviceability.json`, "Operator footprint state from OSRM drive times", serviceability.operators.find(byOperator));
add("serviceability-facilities", `${sampleDir}/serviceability.json`, "Per-facility drive time and band per service line", serviceability.facilities.filter(byCcn));

// 4. Signals.
const signals = copied["signals.json"] as unknown as { operators: { operatorId: string }[]; facilities: { ccn: string }[] };
add("signals-operator", `${sampleDir}/signals.json`, "Operator-level citation and ownership signals", signals.operators.find(byOperator));
add("signals-facilities", `${sampleDir}/signals.json`, "Per-facility fire safety citations by service line with the CMS tag evidence", signals.facilities.filter(byCcn));
const web = await readJson<{ domains: { operatorId: string }[]; jobs: { operatorId: string }[] }>(`${sampleDir}/web-signals.json`);
add("web-signals-domain", `${sampleDir}/web-signals.json`, "Domain found by Serper search", web.domains.filter(byOperator));
trace.push({ step: "web-signals-jobs", ...step(`${sampleDir}/web-signals.json`, "Job posting candidates found by Serper search (footprint operators only, not confirmed open)", web.jobs.filter(byOperator)) });

// 5. Tier record with components.
add("tier", `${sampleDir}/tiers.json`, "Score, band, gate, and components under account-score-v1.1", allTiered.find(byOperator));

// 6. People coverage slots.
const people = copied["people-coverage.json"] as unknown as { operators: { operatorId: string }[]; sites: { ccn: string }[] };
add("people-coverage-operator", `${sampleDir}/people-coverage.json`, "Operator-level Clay coverage slots", people.operators.find(byOperator));
add("people-coverage-sites", `${sampleDir}/people-coverage.json`, "Site-level Clay coverage slots", people.sites.filter(byCcn));

// 7. Clay round trip: Attio export row, Clay export row, and the import plan.
const attioDir = `${sampleDir}/private/clay/attio`;
const findCsvRows = async (file: string) => {
  if (!(await exists(file))) return null;
  return parseCsv(await readFile(resolve(projectRoot, file), "utf8")).filter((row) => spec.match.test(row["company_name"] ?? ""));
};
let attioCompanyId: string | null = null;
for (const name of ["companies-1.csv", "companies-2.csv", "companies-3.csv"]) {
  const rows = await findCsvRows(`${attioDir}/input/${name}`);
  if (rows && rows.length > 0) {
    attioCompanyId = rows[0]!["attio_company_id"] ?? null;
    add("clay-input-row", `${attioDir}/input/${name}`, "Row written by npm run clay:export from the Attio Company (gitignored private file)", rows);
  }
}
if (!attioCompanyId) missing.push(`clay input row: no Attio export row names ${target.name} under ${attioDir}/input`);

const clayExportFile = `${attioDir}/export/companies-3.csv`;
const clayRows = await findCsvRows(clayExportFile);
const roleMap = await readJson<{ version: string; roleSlots: RoleSlot[] }>(`${sampleDir}/clay-role-map.json`);
if (clayRows && clayRows.length > 0) {
  const slotIds = roleMap.roleSlots.map((slot) => slot.id);
  const exportRow = clayRows[0]!;
  // Keeps the Attio input columns and the company proposals (domain, address). Drops every
  // person column (names, titles, employer strings, profile links) and the Clay company name.
  const KEEP = new Set(["attio_company_id", "company_name", "domain", "line_1", "locality", "region", "postcode", "country_code", "needs_domain", "needs_location", "clay_domain", "clay_address", "Website"]);
  const summary = {
    ...Object.fromEntries(Object.entries(exportRow).filter(([key]) => KEEP.has(key))),
    mobileNumberReturned: /success/i.test(exportRow["Mobile Phone Number"] ?? ""),
    peoplePerSlot: Object.fromEntries(slotIds.map((slot) => [slot, exportRow[slot] ?? ""])),
  };
  add("clay-export-row", clayExportFile, "Row exported from Clay table companies-3 (private; only company columns and per-slot people counts are kept)", summary);

  // The import plan as npm run clay:import computes it from this CSV, with the same pure
  // mapping and planner. The planner normally runs against the Attio mirror in Postgres;
  // here the Company is stood in by its ID alone and the ledger is empty, so the plan shows
  // the first-run shape (what the dry run printed on 2026-10-22), not the current rerun.
  const expanded = expandClayTable(clayRows, slotIds);
  const enrichedOn = "2026-10-22";
  const mapped = mapClayRows(expanded, { roleSlots: roleMap.roleSlots, enrichedOn });
  const state: AttioState = {
    companies: attioCompanyId ? [{ id: { workspace_id: "", object_id: "companies", record_id: attioCompanyId }, created_at: enrichedOn, values: {} }] : [],
    people: [],
  };
  const plan = planWriteback(state, mapped.companies, mapped.people, { written: new Map(), created: new Map() });
  // People are identified by slot and position only; names, titles, and profile links stay out.
  const slotOf = (persona: string | undefined) => roleMap.roleSlots.find((slot) => slot.persona === persona)?.id ?? "unknown";
  const label = (p: (typeof mapped.people)[number]) => `person ${mapped.people.indexOf(p) + 1} (slot: ${slotOf(p.persona)})`;
  const who = (sourceKey: string) => { const p = mapped.people.find((x) => x.sourceKey === sourceKey); return p ? label(p) : "company"; };
  add("clay-import-plan", "scripts/clay-attio-import.ts (via scripts/clay-attio-mapping.ts and packages/connectors/src/attio/writeback.ts)", "Writeback plan recomputed from the Clay export with role map " + roleMap.version + "; first-run shape against an empty ledger; people shown by slot and persona status only", {
    roleMapVersion: roleMap.version,
    enrichedOn,
    companyUpdates: mapped.companies.map((c) => ({ companyRecordId: c.companyRecordId, domain: c.domain ?? null, primaryLocation: c.primaryLocation ?? null })),
    peopleCreated: mapped.people.map((p) => ({
      person: label(p), slot: slotOf(p.persona), persona: p.persona ?? null, personaStatus: p.personaVerified ? "verified" : "unverified",
      employerMatch: p.match, mobile: p.mobilePhone ? "present" : "absent", workEmail: p.workEmail ? "present" : "absent",
    })),
    skipped: mapped.skipped,
    operations: plan.operations.map((op) => ({ kind: op.kind, objectType: op.objectType, recordId: op.recordId, subject: who(op.sourceKey), attributes: Object.keys(op.values) })),
    reviewItems: plan.reviews.map((item) => ({ objectType: item.objectType, reason: item.reason, attribute: item.attribute, proposedValue: item.reason === "uncertain_match" || item.reason === "possible_duplicate" ? "(withheld)" : item.proposedValue, detail: item.detail, subject: who(item.sourceKey) })),
  });
} else {
  missing.push(`clay export row: ${clayExportFile} is absent or holds no row for ${target.name}`);
}

// 8. Attio record IDs. The Company ID is in the export CSV. People record IDs live only in the
// writeback ledger (Postgres) and the live workspace; no file in the repo holds them.
add("attio-records", attioCompanyId ? `${attioDir}/input/*.csv (attio_company_id column)` : "none", "Attio record IDs held in repository files", {
  companyRecordId: attioCompanyId,
  peopleRecordIds: null,
  note: "People created on 2026-10-22 are recorded only in the writeback ledger table and in Attio itself; no file in the repository carries their record IDs.",
});

const lineage = {
  generatedAt,
  operator: { operatorId: ID, name: target.name, tradingAs: spec.tradingAs, facilityCcns: target.facilityCcns },
  privacy: "Under the personal data boundary in docs/research/georgia-clay-people-pass.md, no person name, title as written, profile link, employer string, start date, email, or phone number appears here. People appear as a role slot and persona status only; individual CMS owners are withheld.",
  caveat: spec.caveat,
  notFound: missing,
  steps: trace,
};
await writeJson(spec.file, lineage);
return { target, missing };
}

const pruitt = await buildLineage({
  match: /^pruitthealth$/i,
  file: "lineage-pruitthealth.json",
  tradingAs: "PruittHealth (CMS chain 434)",
  caveat: "In-footprint Tier A target: band A, score 49, 41 facilities within 120 minutes of a capable branch. Traced end to end from the CMS rows to the Attio Company and the Clay import plan.",
});
const tift = await buildLineage({
  match: /tift regional|southwell/i,
  file: "lineage-tift-regional.json",
  tradingAs: "Southwell (facility name SOUTHWELL HEALTH AND REHABILITATION, Clay-enriched company name Southwell)",
  caveat: "Out-of-footprint pipeline proof: 140 minutes from Macon, so no band and no people-coverage entry. It was the one-row test of the Clay to Attio round trip, chosen for the test, not for its tier.",
});
const missing = [...pruitt.missing.map((m) => `pruitthealth: ${m}`), ...tift.missing.map((m) => `tift-regional: ${m}`)];

// ---- index --------------------------------------------------------------

const index = `# Portfolio bundle

Generated ${generatedAt} by \`npm run portfolio:bundle\` (scripts/build-portfolio-bundle.ts). Every file carries a generatedAt stamp and the path it was read from. Nothing here calls an API or a database; the script only reads files already in the repository.

- tiers.json: copy of data/georgia-sample/tiers.json, the 105 Georgia operators scored and banded under account-score-v1.1 with tiering proposal 2 parameters, wrapped with generatedAt and source.
- serviceability.json: copy of data/georgia-sample/serviceability.json, OSRM drive times from each facility to the nearest branch per service line and the resulting footprint state.
- people-coverage.json: copy of data/georgia-sample/people-coverage.json, which Clay role slots were searched for each footprint operator and site, with counts only and no names.
- signals.json: copy of data/georgia-sample/signals.json, CMS fire safety citations mapped to service lines plus ownership and management change flags, per operator and per facility.
- tier-summary.json: counts per band, eligibility gate counts, and the top five A-band operators with score and explanation, computed from tiers.json.
- lineage-pruitthealth.json: the end-to-end trace for ${pruitt.target.name}, the in-footprint Tier A target (band A, score 49, 41 footprint facilities). Each step names the file it was read from: the source manifest and raw CMS rows, operator resolution and facility links, serviceability, signals, the tier record with components, people coverage, the Clay input and export rows, the import plan recomputed with the same mapping code, and the Attio Company record ID. The notFound list states what no file could supply.
- lineage-tift-regional.json: the same trace for ${tift.target.name} (trading as Southwell), the out-of-footprint pipeline proof. It sits 140 minutes from the nearest branch, so it has no band and no people coverage; it was the one-row test that proved the Clay to Attio round trip before the Tier A row ran.

Privacy: the raw CMS rows and the Clay CSVs are gitignored private inputs. Under the personal data boundary in docs/research/georgia-clay-people-pass.md the traces hold no person name, title, profile link, employer string, start date, email, or phone number; people appear as a role slot and persona status only, and individual CMS owners are withheld.
`;
await writeFile(resolve(outDir, "index.md"), index, "utf8");

console.log(`Wrote ${copies.length + 4} files to ${outDir}${missing.length ? `; lineage gaps: ${missing.length}` : ""}`);
for (const gap of missing) console.log(`  ${gap}`);
