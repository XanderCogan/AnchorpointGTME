import { z } from "zod";
import type { AttioRecordPayload } from "../../../core/src/attio-mapping.ts";
import type { AttioListEntry } from "../attio/client.ts";
import type { EnrollmentCandidate } from "./enrollment.ts";

// Enrollment input from the read-only Attio mirror: People linked to a mirrored
// Company. Approval is campaign-level (decision 0015): a manager approves the
// campaign and its audience definition once, and a Person is approved when they
// are a member of that campaign's audience List in Attio. An explicit approvals
// file keyed by Attio person record ID remains for tests and offline runs. A
// person with no approval is planned as not_approved, so a missing input denies
// rather than allows.

export interface Approval {
  approvedBy: string;
  approvedAt: string;
}

export interface AttioPersonSlugs {
  name: string;
  email: string;
  jobTitle: string;
  company: string;
  // A checked opt-out becomes a local suppression.
  emailOptOut: string;
}

export const defaultAttioPersonSlugs: AttioPersonSlugs = {
  name: "name",
  email: "email_addresses",
  jobTitle: "job_title",
  company: "company",
  emailOptOut: "email_opt_out",
};

export interface AttioEnrollmentSource {
  candidates: EnrollmentCandidate[];
  localDoNotContact: string[];
  // People left out because they are not linked to a mirrored company.
  unlinked: string[];
}

const approvalsSchema = z.array(
  z.object({ contactKey: z.string().min(1), approvedBy: z.string().min(1), approvedAt: z.string().min(1) }),
);

// Parses an explicit approvals input: [{ contactKey, approvedBy, approvedAt }].
export function parseApprovals(raw: unknown): Map<string, Approval> {
  return new Map(approvalsSchema.parse(raw).map(({ contactKey, ...approval }) => [contactKey, approval]));
}

// Approval from audience List membership. Only People entries count; a Company on
// the List approves nobody. approvedBy names the List, approvedAt is the entry time.
export function approvalsFromListEntries(
  entries: readonly AttioListEntry[],
  listSlug: string,
  peopleObjectSlug = "people",
): Map<string, Approval> {
  const approvals = new Map<string, Approval>();
  for (const entry of entries) {
    if (entry.parent_object !== peopleObjectSlug) continue;
    const existing = approvals.get(entry.parent_record_id);
    if (existing && existing.approvedAt <= entry.created_at) continue;
    approvals.set(entry.parent_record_id, { approvedBy: `attio-list:${listSlug}`, approvedAt: entry.created_at });
  }
  return approvals;
}

type Value = Record<string, unknown>;
const firstValue = (record: AttioRecordPayload, slug: string): Value | undefined => record.values[slug]?.[0];
const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

export function candidatesFromAttio(input: {
  people: readonly AttioRecordPayload[];
  companies: readonly AttioRecordPayload[];
  approvals: ReadonlyMap<string, Approval>;
  slugs?: AttioPersonSlugs;
}): AttioEnrollmentSource {
  const slugs = input.slugs ?? defaultAttioPersonSlugs;
  const companies = new Map(input.companies.map((company) => [company.id.record_id, company]));
  const result: AttioEnrollmentSource = { candidates: [], localDoNotContact: [], unlinked: [] };
  for (const person of input.people) {
    const recordId = person.id.record_id;
    const company = companies.get(str(firstValue(person, slugs.company)?.target_record_id) ?? "");
    if (!company) {
      result.unlinked.push(recordId);
      continue;
    }
    const email = str(firstValue(person, slugs.email)?.email_address) ?? null;
    if (email && firstValue(person, slugs.emailOptOut)?.value === true) result.localDoNotContact.push(email);
    const name = firstValue(person, slugs.name);
    result.candidates.push({
      contactKey: recordId,
      email,
      firstName: str(name?.first_name),
      lastName: str(name?.last_name),
      companyName: str(firstValue(company, "name")?.value),
      companyDomain: str(firstValue(company, "domains")?.domain),
      jobTitle: str(firstValue(person, slugs.jobTitle)?.value),
      approval: input.approvals.get(recordId) ?? null,
    });
  }
  return result;
}
