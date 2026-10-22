// Pure mapping for the free-plan Clay round trip (docs/research/georgia-clay-people-pass.md,
// "Automated round trip (free plan)"). Attio Companies become Clay input rows, and Clay's
// exported rows become CompanyEnrichment and PersonEnrichment inputs for runWriteback.
// No I/O here; scripts/clay-attio-export.ts and scripts/clay-attio-import.ts do the reading
// and writing.
import type { AttioRecord } from "../packages/connectors/src/attio/client.ts";
import type { CompanyEnrichment, Location, PersonEnrichment } from "../packages/connectors/src/attio/writeback.ts";
import { toWritebackNames, type WritebackSlugs } from "../packages/connectors/src/attio/writeback-transport.ts";
import { employerMatches, personaMatches } from "./georgia-sample/clay-summarize.ts";

type Row = Record<string, string>;
type Entry = Record<string, unknown>;

export interface RoleSlot {
  id: string;
  maxPeople: number;
  titleInclude: string[];
  titleExclude: string[];
  persona: string;
}

// Columns the export writes. Clay carries them through to its export unchanged.
export const EXPORT_COLUMNS = [
  "attio_company_id",
  "company_name",
  "domain",
  "line_1",
  "locality",
  "region",
  "postcode",
  "country_code",
  "needs_domain",
  "needs_location",
] as const;

// Columns the Clay table adds. Company proposals use the clay_ prefix; a row with a first and
// last name is a person found by the search column named in `slot`.
export const COMPANY_PROPOSAL_COLUMNS = ["clay_domain", "clay_line_1", "clay_locality", "clay_region", "clay_postcode", "clay_country_code"] as const;
export const PERSON_COLUMNS = ["slot", "first_name", "last_name", "job_title", "work_email", "linkedin_url", "person_company_name", "person_company_domain"] as const;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const first = (values: Record<string, unknown>, attribute: string): Entry | undefined => ((values[attribute] ?? []) as Entry[])[0];

// Renames a mirrored record's suffixed workspace slugs back to writeback names.
export function toWritebackRecord(payload: { id: Record<string, unknown>; created_at: string; values: Record<string, unknown> }, slugs: WritebackSlugs): AttioRecord {
  return { ...payload, values: toWritebackNames(payload.values, slugs) } as AttioRecord;
}

export function companyExportRow(record: AttioRecord): Record<(typeof EXPORT_COLUMNS)[number], string> {
  const values = record.values as Record<string, unknown>;
  const domain = str(first(values, "domains")?.domain);
  const location = first(values, "primary_location");
  const locality = str(location?.locality);
  return {
    attio_company_id: record.id.record_id,
    company_name: str(first(values, "name")?.value),
    domain,
    line_1: str(location?.line_1),
    locality,
    region: str(location?.region),
    postcode: str(location?.postcode),
    country_code: str(location?.country_code),
    needs_domain: String(!domain),
    needs_location: String(!locality),
  };
}

export const toCsv = (rows: Record<string, string>[], columns: readonly string[]) => {
  const quote = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column] ?? "")).join(","))].join("\n") + "\n";
};

export interface ImportResult {
  companies: CompanyEnrichment[];
  people: PersonEnrichment[];
  // Rows skipped before planning, with a reason; these never reach Attio.
  skipped: { row: number; reason: string }[];
}

export interface ImportOptions {
  roleSlots: RoleSlot[];
  // ISO date (YYYY-MM-DD) the Clay export was made.
  enrichedOn: string;
  source?: string;
}

const cell = (row: Row, column: string) => (row[column] ?? "").trim();

function proposedLocation(row: Row): Location | undefined {
  const locality = cell(row, "clay_locality");
  const region = cell(row, "clay_region");
  if (!locality || !region) return undefined;
  return {
    line1: cell(row, "clay_line_1") || null,
    locality,
    region,
    postcode: cell(row, "clay_postcode") || null,
    countryCode: (cell(row, "clay_country_code") || "US").toUpperCase(),
  };
}

const personKey = (row: Row) =>
  (cell(row, "linkedin_url") || cell(row, "work_email") || `${cell(row, "first_name")} ${cell(row, "last_name")}`).toLowerCase().replace(/\s+/g, " ");

// Maps Clay export rows to writeback inputs. One company enrichment per Attio company: the
// first non-empty proposal per field wins, and a differing later proposal drops that field and
// is reported as skipped, so a disagreement is never written. People need a known role slot;
// the persona comes from the role map and is verified only when the title passes the slot's
// include and exclude patterns, as in clay-summarize.ts. A person is a confirmed match only
// when their current employer matches the Attio company by domain or a distinctive name word.
export function mapClayRows(rows: Row[], options: ImportOptions): ImportResult {
  const slots = new Map(options.roleSlots.map((slot) => [slot.id, slot]));
  const source = options.source ?? "clay";
  const result: ImportResult = { companies: [], people: [], skipped: [] };
  const companies = new Map<string, CompanyEnrichment & { conflicted: Set<string> }>();
  const seenPeople = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is line 1
    const companyRecordId = cell(row, "attio_company_id");
    if (!companyRecordId) {
      result.skipped.push({ row: rowNumber, reason: "missing attio_company_id" });
      return;
    }

    const company = companies.get(companyRecordId) ?? { sourceKey: `clay:company:${companyRecordId}`, companyRecordId, conflicted: new Set<string>() };
    companies.set(companyRecordId, company);
    const domain = cell(row, "clay_domain");
    if (domain && !company.conflicted.has("domain")) {
      if (company.domain === undefined) company.domain = domain;
      else if (company.domain.toLowerCase() !== domain.toLowerCase()) {
        company.conflicted.add("domain");
        delete company.domain;
        result.skipped.push({ row: rowNumber, reason: `conflicting clay_domain for ${companyRecordId}` });
      }
    }
    const location = proposedLocation(row);
    if (location && !company.conflicted.has("location")) {
      if (company.primaryLocation === undefined) company.primaryLocation = location;
      else if (JSON.stringify(company.primaryLocation).toLowerCase() !== JSON.stringify(location).toLowerCase()) {
        company.conflicted.add("location");
        delete company.primaryLocation;
        result.skipped.push({ row: rowNumber, reason: `conflicting clay location for ${companyRecordId}` });
      }
    }

    const firstName = cell(row, "first_name");
    const lastName = cell(row, "last_name");
    if (!firstName && !lastName) return;
    if (!firstName || !lastName) {
      result.skipped.push({ row: rowNumber, reason: "person needs both first_name and last_name" });
      return;
    }
    const slot = slots.get(cell(row, "slot"));
    if (!slot) {
      result.skipped.push({ row: rowNumber, reason: `unknown slot "${cell(row, "slot")}"` });
      return;
    }
    const sourceKey = `clay:person:${companyRecordId}:${personKey(row)}`;
    if (seenPeople.has(sourceKey)) {
      result.skipped.push({ row: rowNumber, reason: "repeated person row" });
      return;
    }
    seenPeople.add(sourceKey);
    const jobTitle = cell(row, "job_title");
    const employer = employerMatches(
      { c: cell(row, "person_company_name"), d: cell(row, "person_company_domain") },
      cell(row, "domain") || domain,
      cell(row, "company_name"),
    );
    const person: PersonEnrichment = {
      sourceKey,
      companyRecordId,
      match: employer ? "confirmed" : "uncertain",
      firstName,
      lastName,
      // Attio's persona options carry no "(provisional)" marker; the role map keeps it.
      persona: slot.persona.replace(/\s*\(provisional\)$/i, ""),
      personaVerified: personaMatches(jobTitle, slot),
      source,
      enrichedOn: options.enrichedOn,
    };
    if (jobTitle) person.jobTitle = jobTitle;
    const email = cell(row, "work_email");
    if (email) person.workEmail = email;
    const linkedin = cell(row, "linkedin_url");
    if (linkedin) person.linkedinUrl = linkedin;
    result.people.push(person);
  });

  for (const { conflicted: _conflicted, ...company } of companies.values()) {
    if (company.domain !== undefined || company.primaryLocation !== undefined) result.companies.push(company);
  }
  return result;
}
