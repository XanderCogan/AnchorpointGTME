// Stage 2 of docs/research/georgia-senior-living-sample-plan.md.
// Resolves each Georgia nursing home to an operator account from the raw CMS pull:
//   1. CMS chain_id (Provider Information)
//   2. one corroborated organization with OPERATIONAL/MANAGERIAL CONTROL (Ownership)
//   3. legal business name (Provider Information)
// Facilities whose operator is unclear are not merged. They keep a provisional operator
// under rule 3 and go to the manual review list.
// The repository is public: individual owners never enter the output, and any business
// name that could be a person's name is withheld.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");

type Row = Record<string, string>;
type Rule = "chain_id" | "operational_managerial_control" | "legal_business_name";

const PROVIDER = "4pq5-n9py";
const OWNERSHIP = "y2hd-n93e";
const OMC_ROLE = "OPERATIONAL/MANAGERIAL CONTROL";
const OWNERSHIP_INTEREST = /OWNERSHIP INTEREST|PARTNERSHIP INTEREST/;

const manifest = JSON.parse(await readFile(resolve(sampleRoot, "source-manifest.json"), "utf8")) as {
  datasets: { datasetId: string; retrievedOn: string; cmsModified: string; sha256: string }[];
};
const sourceOf = (id: string) => {
  const entry = manifest.datasets.find((dataset) => dataset.datasetId === id);
  if (!entry) throw new Error(`Dataset ${id} is missing from the manifest; run pull-cms.ts first`);
  return entry;
};
const readRaw = async (id: string) =>
  JSON.parse(await readFile(resolve(sampleRoot, "raw/cms", `${id}.json`), "utf8")) as Row[];

const providers = (await readRaw(PROVIDER)).sort((a, b) => ccnOf(a).localeCompare(ccnOf(b)));
const ownership = await readRaw(OWNERSHIP);

function ccnOf(row: Row): string {
  return row.cms_certification_number_ccn ?? "";
}

function normalize(name: string): string {
  return name
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(name: string): string {
  return normalize(name).toLowerCase().replace(/ /g, "-");
}

// A name is publishable only if it reads as an organization. Names with no organizational
// word, and trust or family names, may identify individuals and are withheld.
const ORGANIZATION_WORD =
  /\b(LLC|L L C|L P|OPCO|INC|CORP|CORPORATION|CO|COMPANY|LP|LLP|LTD|PLLC|PC|AUTHORITY|ASSOCIATION|FOUNDATION|SYSTEMS?|HOSPITALS?|CENTERS?|CTR|HOMES?|MANAGEMENT|HEALTHCARE|CARE|LIVING|SERVICES|HOLDINGS|GARDENS|PROPERTIES|COMMUNITIES|GROUP|PARTNERS|COUNTY|CITY|STATE|DEPARTMENT|NURSING|REHABILITATION|MEDICAL|SENIOR|MINISTRIES|CHURCH|AMERICA|RETIREMENT|OPERATOR|OPERATING|ENTERPRISES|VILLAGE|MANOR|LTC|NSG|FACILITY)\b|HEALTH/;
const PERSONAL_MARKER = /\b(TRUST|TR|IRRV|IRREVOCABLE|REVOCABLE|FBO|ESTATE|FAMILY)\b/;

function isPublishable(name: string): boolean {
  const normalized = normalize(name);
  return ORGANIZATION_WORD.test(normalized) && !PERSONAL_MARKER.test(normalized);
}

const WITHHELD = "[withheld: may name an individual]";
const publish = (name: string) => (isPublishable(name) ? name : WITHHELD);

// Distinctive words used to corroborate that an organization belongs to a facility.
const GENERIC_WORDS = new Set(
  (
    "LLC INC CORP CORPORATION COMPANY THE AND OF FOR AT IN HEALTH HEALTHCARE CARE CENTER CENTERS CTR " +
    "NURSING REHABILITATION REHAB HOME HOMES MANAGEMENT SERVICES LIVING SENIOR GROUP HOLDINGS OPERATING " +
    "OPERATOR OPERATIONS PARTNERS MEDICAL HOSPITAL SYSTEM SYSTEMS SKILLED FACILITY GEORGIA COUNTY CITY " +
    "HEALING CONVALESCENT LONG TERM INTERNATIONAL AMERICA NATIONAL"
  ).split(" "),
);
// The facility's own city and county are not distinctive: a contractor named for the town
// it serves would otherwise look like the operator.
const distinctiveWords = (name: string, place: Set<string> = new Set()) =>
  new Set(
    normalize(name)
      .split(" ")
      .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word) && !place.has(word)),
  );

// CMS publishes this placeholder instead of an empty legal business name.
const LEGAL_NAME_MISSING = "LEGAL BUSINESS NAME NOT AVAILABLE";
const legalNameOf = (facility: Row) => {
  const name = facility.legal_business_name ?? "";
  return normalize(name) === LEGAL_NAME_MISSING ? "" : name;
};

const ownershipByCcn = new Map<string, Row[]>();
for (const row of ownership) {
  const rows = ownershipByCcn.get(ccnOf(row)) ?? [];
  rows.push(row);
  ownershipByCcn.set(ccnOf(row), rows);
}

type Candidate = { name: string; corroboration: string[] };

function omcCandidates(facility: Row): { candidates: Candidate[]; excludedSelf: boolean } {
  const rows = ownershipByCcn.get(ccnOf(facility)) ?? [];
  const legalName = normalize(legalNameOf(facility));
  const place = new Set(normalize(`${facility.citytown ?? ""} ${facility.countyparish ?? ""}`).split(" "));
  const facilityWords = new Set([
    ...distinctiveWords(legalNameOf(facility), place),
    ...distinctiveWords(facility.provider_name ?? "", place),
  ]);
  const names = new Set(
    rows
      .filter((row) => row.owner_type === "Organization" && row.role_played_by_owner_or_manager_in_facility === OMC_ROLE)
      .map((row) => row.owner_name ?? ""),
  );
  let excludedSelf = false;
  const candidates: Candidate[] = [];
  for (const name of [...names].sort()) {
    if (normalize(name) === legalName) {
      excludedSelf = true;
      continue;
    }
    const corroboration: string[] = [];
    const holdsInterest = rows.some(
      (row) =>
        row.owner_type === "Organization" &&
        normalize(row.owner_name ?? "") === normalize(name) &&
        OWNERSHIP_INTEREST.test(row.role_played_by_owner_or_manager_in_facility ?? ""),
    );
    if (holdsInterest) corroboration.push(`also holds an ownership interest (${OWNERSHIP}.role_played_by_owner_or_manager_in_facility)`);
    const shared = [...distinctiveWords(name, place)].filter((word) => facilityWords.has(word));
    if (shared.length > 0) corroboration.push(`shares the distinctive name word ${shared.join(", ")} with the facility`);
    candidates.push({ name, corroboration });
  }
  return { candidates, excludedSelf };
}

type Operator = {
  operatorId: string;
  name: string;
  nameSource: string;
  resolutionRule: Rule;
  status: "resolved" | "provisional";
  cmsChainId: string | null;
  cmsChainFacilitiesNationwide: number | null;
  georgiaFacilityCount: number;
  facilityCcns: string[];
};

type Link = {
  ccn: string;
  facilityName: string;
  legalBusinessName: string;
  address: string;
  city: string;
  zip: string;
  county: string;
  certifiedBeds: number | null;
  ownershipType: string;
  operatorId: string;
  resolutionRule: Rule;
  status: "resolved" | "provisional";
  source: { dataset: string; field: string; value: string; cmsModified: string; retrievedOn: string };
};

type ReviewCase = {
  caseId: string;
  ccn: string | null;
  facilityName: string | null;
  cmsChainId: string | null;
  issue: string;
  provisionalOperatorId: string;
  candidates: { name: string; sourceField: string; corroboration: string[] }[];
};

const operators = new Map<string, Operator>();
const links: Link[] = [];
const reviewCases: ReviewCase[] = [];
const provider = sourceOf(PROVIDER);
const owners = sourceOf(OWNERSHIP);

function attach(operator: Omit<Operator, "georgiaFacilityCount" | "facilityCcns">, facility: Row, field: string, value: string, dataset = provider, datasetId = PROVIDER) {
  const existing = operators.get(operator.operatorId) ?? { ...operator, georgiaFacilityCount: 0, facilityCcns: [] };
  existing.facilityCcns.push(ccnOf(facility));
  existing.georgiaFacilityCount = existing.facilityCcns.length;
  operators.set(operator.operatorId, existing);
  const beds = Number.parseInt(facility.number_of_certified_beds ?? "", 10);
  links.push({
    ccn: ccnOf(facility),
    facilityName: facility.provider_name ?? "",
    legalBusinessName: legalNameOf(facility) ? publish(legalNameOf(facility)) : "[not available in CMS]",
    address: facility.provider_address ?? "",
    city: facility.citytown ?? "",
    zip: facility.zip_code ?? "",
    county: facility.countyparish ?? "",
    certifiedBeds: Number.isNaN(beds) ? null : beds,
    ownershipType: facility.ownership_type ?? "",
    operatorId: existing.operatorId,
    resolutionRule: operator.resolutionRule,
    status: operator.status,
    source: { dataset: datasetId, field, value: publish(value), cmsModified: dataset.cmsModified, retrievedOn: dataset.retrievedOn },
  });
}

// Facilities share a rule-3 operator only when CMS lists the same publishable legal entity.
// Without one, the facility stands alone under its CCN.
function legalNameOperator(facility: Row, status: "resolved" | "provisional") {
  const legalName = legalNameOf(facility);
  const publishable = legalName !== "" && isPublishable(legalName);
  const operatorId = publishable ? `ga-op-lbn-${slug(legalName)}` : `ga-op-ccn-${ccnOf(facility)}`;
  attach(
    {
      operatorId,
      name: publishable ? legalName : facility.provider_name ?? "",
      nameSource: publishable
        ? `${PROVIDER}.legal_business_name`
        : `${PROVIDER}.provider_name (legal_business_name ${legalName ? "withheld" : "not available"})`,
      resolutionRule: "legal_business_name",
      status,
      cmsChainId: null,
      cmsChainFacilitiesNationwide: null,
    },
    facility,
    "legal_business_name",
    legalName || "[not available in CMS]",
  );
  return operatorId;
}

// Rule 1: CMS chain affiliation.
const chainFacilities = new Map<string, Row[]>();
for (const facility of providers) {
  if (!facility.chain_id) continue;
  const rows = chainFacilities.get(facility.chain_id) ?? [];
  rows.push(facility);
  chainFacilities.set(facility.chain_id, rows);
}
for (const [chainId, facilities] of chainFacilities) {
  const chainName = facilities[0]?.chain_name ?? "";
  const operatorId = `ga-op-chain-${chainId}`;
  const publishable = isPublishable(chainName);
  if (!publishable) {
    reviewCases.push({
      caseId: `chain-name-${chainId}`,
      ccn: null,
      facilityName: null,
      cmsChainId: chainId,
      issue:
        "The CMS chain name may identify an individual, so it is withheld. Facilities stay grouped under the chain; the operator needs a publishable organization name from a public business source.",
      provisionalOperatorId: operatorId,
      candidates: [],
    });
  }
  const nationwide = Number.parseInt(facilities[0]?.number_of_facilities_in_chain ?? "", 10);
  for (const facility of facilities) {
    attach(
      {
        operatorId,
        name: publishable ? chainName : `CMS chain ${chainId} ${WITHHELD}`,
        nameSource: publishable ? `${PROVIDER}.chain_name` : `${PROVIDER}.chain_id (chain_name withheld)`,
        resolutionRule: "chain_id",
        status: "resolved",
        cmsChainId: chainId,
        cmsChainFacilitiesNationwide: Number.isNaN(nationwide) ? null : nationwide,
      },
      facility,
      "chain_id",
      chainId,
    );
  }
}

// Rules 2 and 3 for facilities outside a CMS chain.
for (const facility of providers) {
  if (facility.chain_id) continue;
  const { candidates } = omcCandidates(facility);
  const corroborated = candidates.filter((candidate) => candidate.corroboration.length > 0);

  if (candidates.length === 0 && legalNameOf(facility)) {
    legalNameOperator(facility, "resolved");
    continue;
  }
  if (candidates.length === 0) {
    const provisionalOperatorId = legalNameOperator(facility, "provisional");
    reviewCases.push({
      caseId: `facility-${ccnOf(facility)}`,
      ccn: ccnOf(facility),
      facilityName: facility.provider_name ?? null,
      cmsChainId: null,
      issue:
        "CMS lists no legal business name and no ownership data. The facility stands alone as its own operator until a public source names its operator.",
      provisionalOperatorId,
      candidates: [],
    });
    continue;
  }
  if (corroborated.length === 1 && isPublishable(corroborated[0]!.name)) {
    const operatorName = corroborated[0]!.name;
    attach(
      {
        operatorId: `ga-op-org-${slug(operatorName)}`,
        name: operatorName,
        nameSource: `${OWNERSHIP}.owner_name`,
        resolutionRule: "operational_managerial_control",
        status: "resolved",
        cmsChainId: null,
        cmsChainFacilitiesNationwide: null,
      },
      facility,
      "owner_name where role_played_by_owner_or_manager_in_facility = OPERATIONAL/MANAGERIAL CONTROL and owner_type = Organization",
      operatorName,
      owners,
      OWNERSHIP,
    );
    continue;
  }

  const provisionalOperatorId = legalNameOperator(facility, "provisional");
  reviewCases.push({
    caseId: `facility-${ccnOf(facility)}`,
    ccn: ccnOf(facility),
    facilityName: facility.provider_name ?? null,
    cmsChainId: null,
    issue:
      corroborated.length > 1
        ? "More than one organization with operational or managerial control is corroborated."
        : corroborated.length === 1
          ? "The only corroborated organization's name may identify an individual."
          : "Organizations with operational or managerial control are not corroborated as the operator; they may be contractors such as therapy, dining, or lending firms.",
    provisionalOperatorId,
    candidates: candidates.map((candidate) => ({
      name: publish(candidate.name),
      sourceField: `${OWNERSHIP}.owner_name (OPERATIONAL/MANAGERIAL CONTROL, Organization)`,
      corroboration: candidate.corroboration,
    })),
  });
}

// An operator is provisional while any of its facilities awaits review.
for (const link of links) {
  if (link.status === "provisional") operators.get(link.operatorId)!.status = "provisional";
}

// Personal-data guard: no individual owner's name may appear anywhere in the output.
const operatorList = [...operators.values()].sort((a, b) => a.operatorId.localeCompare(b.operatorId));
const output = {
  operators: JSON.stringify(operatorList),
  links: JSON.stringify(links),
  review: JSON.stringify(reviewCases),
};
const individualNames = new Set<string>();
for (const row of ownership) {
  if (row.owner_type !== "Individual" || !row.owner_name) continue;
  const [last, first] = row.owner_name.split(",").map((part) => normalize(part));
  if (last && first) {
    individualNames.add(`${first} ${last}`);
    individualNames.add(`${last} ${first}`);
  }
}
const normalizedOutput = normalize(Object.values(output).join(" "));
const leaks = [...individualNames].filter((name) => name.length > 6 && ` ${normalizedOutput} `.includes(` ${name} `));
if (leaks.length > 0) throw new Error(`Personal-data guard: ${leaks.length} individual owner names reached the output`);

const generatedFrom = {
  script: "scripts/georgia-sample/resolve-operators.ts",
  sources: [PROVIDER, OWNERSHIP].map((id) => {
    const entry = sourceOf(id);
    return { datasetId: id, cmsModified: entry.cmsModified, retrievedOn: entry.retrievedOn, sha256: entry.sha256 };
  }),
};
const write = (file: string, key: string, value: unknown) =>
  writeFile(resolve(sampleRoot, file), `${JSON.stringify({ generatedFrom, [key]: value }, null, 2)}\n`, "utf8");

await write("operators.json", "operators", operatorList);
await write("facility-operator-links.json", "links", links);
await write("operator-review.json", "reviewCases", reviewCases);

const byRule = (rule: Rule) => operatorList.filter((operator) => operator.resolutionRule === rule);
process.stdout.write(
  `${JSON.stringify(
    {
      facilities: links.length,
      operators: operatorList.length,
      operatorsResolved: operatorList.filter((operator) => operator.status === "resolved").length,
      operatorsProvisional: operatorList.filter((operator) => operator.status === "provisional").length,
      chainOperators: byRule("chain_id").length,
      omcOperators: byRule("operational_managerial_control").length,
      legalNameOperators: byRule("legal_business_name").length,
      multiSiteOperators: operatorList.filter((operator) => operator.georgiaFacilityCount > 1).length,
      reviewCases: reviewCases.length,
      reviewFacilityCases: reviewCases.filter((item) => item.ccn).length,
      reviewChainNameCases: reviewCases.filter((item) => item.cmsChainId).length,
    },
    null,
    2,
  )}\n`,
);
