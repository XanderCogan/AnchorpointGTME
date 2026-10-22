import { createHash } from "node:crypto";
import { z } from "zod";
import { attioRecordSchema, type AttioRecord } from "./client.ts";
import type { WritebackTransport } from "./writeback-transport.ts";

// Enrichment writeback: Clay results into Attio under the write policy in
// docs/milestones/attio-writeback-notes.md. Planning is pure; it reads the current
// Attio records and the local writeback ledger and returns the writes to make and
// the items a human must review. Only fills empty fields, or replaces a value this
// writeback wrote earlier; a differing human value is never overwritten.

export type WritebackObject = "companies" | "people";

export interface Location {
  line1: string | null;
  locality: string;
  region: string;
  postcode: string | null;
  countryCode: string;
}

export interface CompanyEnrichment {
  // Stable key of the enrichment row, such as the Clay row ID.
  sourceKey: string;
  companyRecordId: string;
  domain?: string;
  primaryLocation?: Location;
}

export interface PersonEnrichment {
  sourceKey: string;
  companyRecordId: string;
  // Set when the enrichment row already names an Attio person; otherwise a new one is created.
  personRecordId?: string;
  // Anything but a confirmed identity match goes to review without a write.
  match: "confirmed" | "uncertain";
  firstName: string;
  lastName: string;
  jobTitle?: string;
  workEmail?: string;
  // E.164 mobile number, such as +12295550100.
  mobilePhone?: string;
  linkedinUrl?: string;
  persona?: string;
  personaVerified: boolean;
  source: string;
  // ISO date (YYYY-MM-DD) the enrichment was retrieved.
  enrichedOn: string;
}

export type ReviewReason =
  | "conflict"
  | "uncertain_match"
  | "possible_duplicate"
  | "persona_unverified"
  | "company_not_found"
  | "person_not_found";

export interface ReviewItem {
  key: string;
  objectType: WritebackObject;
  recordId: string | null;
  sourceKey: string;
  reason: ReviewReason;
  attribute: string | null;
  currentValue: string | null;
  proposedValue: string | null;
  detail: string;
}

export interface WriteOperation {
  kind: "create" | "update";
  objectType: WritebackObject;
  recordId: string | null;
  sourceKey: string;
  values: Record<string, unknown>;
  // Normalized value per written attribute, recorded in the ledger after the write.
  written: Record<string, string>;
}

export interface WritebackPlan {
  operations: WriteOperation[];
  reviews: ReviewItem[];
}

export interface LedgerSnapshot {
  // `${objectType}:${recordId}:${attribute}` -> normalized value this writeback last wrote.
  written: Map<string, string>;
  // `${objectType}:${sourceKey}` -> record ID this writeback created.
  created: Map<string, string>;
}

export interface WritebackStore {
  loadLedger(connectionId: string): Promise<LedgerSnapshot>;
  recordCreated(connectionId: string, objectType: WritebackObject, sourceKey: string, recordId: string): Promise<void>;
  recordWritten(connectionId: string, objectType: WritebackObject, recordId: string, written: Record<string, string>): Promise<void>;
  // Returns true when the item is new; a repeated item is ignored.
  enqueueReview(connectionId: string, item: ReviewItem): Promise<boolean>;
}

export interface AttioState {
  companies: AttioRecord[];
  people: AttioRecord[];
}

// ---- value normalization -------------------------------------------------

type Values = AttioRecord["values"];

const text = (value: string) => value.trim().replace(/\s+/g, " ");
const lower = (value: string) => text(value).toLowerCase();
const domainOf = (value: string) => lower(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const phoneOf = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `+${digits.length === 10 ? `1${digits}` : digits}` : "";
};
const linkedinOf = (value: string) => lower(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
const nameKey = (first: string, last: string) => `${lower(first)}|${lower(last)}`;
const locationKey = (location: Location) =>
  [location.line1 ?? "", location.locality, location.region, location.postcode ?? "", location.countryCode].map(lower).join("|");

function field(values: Values, attribute: string): Record<string, unknown>[] {
  return (values[attribute] ?? []) as Record<string, unknown>[];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Current normalized values of an attribute; empty means the field is empty.
function currentValues(values: Values, attribute: string): string[] {
  const entries = field(values, attribute);
  switch (attribute) {
    case "domains":
      return entries.map((entry) => domainOf(str(entry.domain))).filter(Boolean);
    case "email_addresses":
      return entries.map((entry) => lower(str(entry.email_address))).filter(Boolean);
    case "primary_location":
      return entries
        .filter((entry) => str(entry.locality) || str(entry.line_1))
        .map((entry) =>
          locationKey({
            line1: str(entry.line_1) || null,
            locality: str(entry.locality),
            region: str(entry.region),
            postcode: str(entry.postcode) || null,
            countryCode: str(entry.country_code),
          }),
        );
    case "name":
      return entries.filter((entry) => str(entry.first_name) || str(entry.last_name)).map((entry) => nameKey(str(entry.first_name), str(entry.last_name)));
    case "persona": {
      return entries.map((entry) => lower(str((entry.option as Record<string, unknown> | undefined)?.title))).filter(Boolean);
    }
    case "persona_verified":
      // An unchecked checkbox counts as empty.
      return entries.filter((entry) => entry.value === true).map(() => "true");
    case "linkedin":
      return entries.map((entry) => linkedinOf(str(entry.value))).filter(Boolean);
    case "phone_numbers":
      return entries.map((entry) => phoneOf(str(entry.phone_number) || str(entry.original_phone_number))).filter(Boolean);
    default:
      return entries.map((entry) => lower(str(entry.value))).filter(Boolean);
  }
}

const multiValued = new Set(["domains", "email_addresses", "phone_numbers"]);

interface Proposal {
  attribute: string;
  normalized: string;
  display: string;
  write: unknown;
}

function companyProposals(input: CompanyEnrichment): Proposal[] {
  const proposals: Proposal[] = [];
  if (input.domain) {
    const domain = domainOf(input.domain);
    proposals.push({ attribute: "domains", normalized: domain, display: domain, write: [domain] });
  }
  if (input.primaryLocation) {
    const location = input.primaryLocation;
    proposals.push({
      attribute: "primary_location",
      normalized: locationKey(location),
      display: [location.line1, location.locality, location.region, location.postcode, location.countryCode].filter(Boolean).join(", "),
      write: {
        line_1: location.line1,
        line_2: null,
        line_3: null,
        line_4: null,
        locality: location.locality,
        region: location.region,
        postcode: location.postcode,
        country_code: location.countryCode,
        latitude: null,
        longitude: null,
      },
    });
  }
  return proposals;
}

function personProposals(input: PersonEnrichment, includePersona: boolean): Proposal[] {
  const proposals: Proposal[] = [];
  const first = text(input.firstName);
  const last = text(input.lastName);
  proposals.push({
    attribute: "name",
    normalized: nameKey(first, last),
    display: `${first} ${last}`,
    write: [{ first_name: first, last_name: last, full_name: `${first} ${last}` }],
  });
  if (input.jobTitle) proposals.push({ attribute: "job_title", normalized: lower(input.jobTitle), display: text(input.jobTitle), write: text(input.jobTitle) });
  if (input.workEmail) {
    const email = lower(input.workEmail);
    proposals.push({ attribute: "email_addresses", normalized: email, display: email, write: [email] });
  }
  if (input.mobilePhone && phoneOf(input.mobilePhone)) {
    const phone = phoneOf(input.mobilePhone);
    proposals.push({ attribute: "phone_numbers", normalized: phone, display: phone, write: [{ original_phone_number: phone, country_code: "US" }] });
  }
  if (input.linkedinUrl) {
    proposals.push({ attribute: "linkedin", normalized: linkedinOf(input.linkedinUrl), display: text(input.linkedinUrl), write: text(input.linkedinUrl) });
  }
  if (includePersona && input.persona) {
    proposals.push({ attribute: "persona", normalized: lower(input.persona), display: text(input.persona), write: text(input.persona) });
    proposals.push({ attribute: "persona_verified", normalized: "true", display: "true", write: true });
  }
  return proposals;
}

function stampProposals(input: PersonEnrichment): Proposal[] {
  return [
    { attribute: "enrichment_source", normalized: lower(input.source), display: text(input.source), write: text(input.source) },
    { attribute: "enrichment_date", normalized: input.enrichedOn, display: input.enrichedOn, write: input.enrichedOn },
  ];
}

// ---- planning --------------------------------------------------------------

function reviewItem(fields: Omit<ReviewItem, "key">): ReviewItem {
  const key = createHash("sha256")
    .update(JSON.stringify([fields.objectType, fields.recordId ?? fields.sourceKey, fields.reason, fields.attribute, fields.proposedValue]))
    .digest("hex");
  return { key, ...fields };
}

interface Decided {
  values: Record<string, unknown>;
  written: Record<string, string>;
  reviews: ReviewItem[];
}

// Applies the fill-empty, own-value, and conflict rules attribute by attribute.
function decide(
  objectType: WritebackObject,
  record: AttioRecord,
  sourceKey: string,
  proposals: Proposal[],
  ledger: LedgerSnapshot,
): Decided {
  const decided: Decided = { values: {}, written: {}, reviews: [] };
  const recordId = record.id.record_id;
  for (const proposal of proposals) {
    const current = currentValues(record.values, proposal.attribute);
    if (current.includes(proposal.normalized)) continue;
    const ours = ledger.written.get(`${objectType}:${recordId}:${proposal.attribute}`);
    // A single-valued field this writeback filled may be refreshed. Multi-valued
    // fields append on update, so any existing value there goes to review.
    const replaceable = current.length === 0 || (!multiValued.has(proposal.attribute) && current.length === 1 && current[0] === ours);
    if (replaceable) {
      decided.values[proposal.attribute] = proposal.write;
      decided.written[proposal.attribute] = proposal.normalized;
    } else {
      decided.reviews.push(
        reviewItem({
          objectType,
          recordId,
          sourceKey,
          reason: "conflict",
          attribute: proposal.attribute,
          currentValue: current.join("; "),
          proposedValue: proposal.display,
          detail: `Attio holds a different value that this writeback did not write; it was not overwritten.`,
        }),
      );
    }
  }
  return decided;
}

function companyLinkOf(person: AttioRecord): string | null {
  const link = field(person.values, "company")[0];
  return link ? str(link.target_record_id) || null : null;
}

export function planWriteback(
  state: AttioState,
  companies: CompanyEnrichment[],
  people: PersonEnrichment[],
  ledger: LedgerSnapshot,
): WritebackPlan {
  const plan: WritebackPlan = { operations: [], reviews: [] };
  const companyById = new Map(state.companies.map((record) => [record.id.record_id, record]));
  const personById = new Map(state.people.map((record) => [record.id.record_id, record]));

  for (const input of companies) {
    const record = companyById.get(input.companyRecordId);
    if (!record) {
      plan.reviews.push(
        reviewItem({
          objectType: "companies", recordId: input.companyRecordId, sourceKey: input.sourceKey, reason: "company_not_found",
          attribute: null, currentValue: null, proposedValue: null, detail: "The enrichment names a Company that is not in Attio.",
        }),
      );
      continue;
    }
    const decided = decide("companies", record, input.sourceKey, companyProposals(input), ledger);
    plan.reviews.push(...decided.reviews);
    if (Object.keys(decided.values).length > 0) {
      plan.operations.push({ kind: "update", objectType: "companies", recordId: record.id.record_id, sourceKey: input.sourceKey, values: decided.values, written: decided.written });
    }
  }

  for (const input of people) {
    const base = { objectType: "people" as const, sourceKey: input.sourceKey };
    if (!companyById.has(input.companyRecordId)) {
      plan.reviews.push(reviewItem({ ...base, recordId: input.personRecordId ?? null, reason: "company_not_found", attribute: null, currentValue: null, proposedValue: input.companyRecordId, detail: "The person's Company is not in Attio; no person is created without one." }));
      continue;
    }
    if (input.match !== "confirmed") {
      plan.reviews.push(reviewItem({ ...base, recordId: input.personRecordId ?? null, reason: "uncertain_match", attribute: null, currentValue: null, proposedValue: `${input.firstName} ${input.lastName}`, detail: "The enrichment identity match is not confirmed." }));
      continue;
    }

    const targetId = input.personRecordId ?? ledger.created.get(`people:${input.sourceKey}`);
    const target = targetId ? personById.get(targetId) : undefined;
    if (targetId && !target) {
      plan.reviews.push(reviewItem({ ...base, recordId: targetId, reason: "person_not_found", attribute: null, currentValue: null, proposedValue: null, detail: "The named person is not in Attio." }));
      continue;
    }
    if (target && companyLinkOf(target) !== input.companyRecordId) {
      plan.reviews.push(reviewItem({ ...base, recordId: targetId!, reason: "uncertain_match", attribute: "company", currentValue: companyLinkOf(target), proposedValue: input.companyRecordId, detail: "The person in Attio links to a different Company, or none." }));
      continue;
    }

    const email = input.workEmail ? lower(input.workEmail) : null;
    const name = nameKey(input.firstName, input.lastName);
    const duplicates = state.people.filter((other) => {
      if (other.id.record_id === targetId) return false;
      const sameEmail = email !== null && currentValues(other.values, "email_addresses").includes(email);
      const sameName = companyLinkOf(other) === input.companyRecordId && currentValues(other.values, "name").includes(name);
      return sameEmail || sameName;
    });
    if (duplicates.length > 0) {
      plan.reviews.push(reviewItem({
        ...base, recordId: targetId ?? null, reason: "possible_duplicate", attribute: null,
        currentValue: duplicates.map((other) => other.id.record_id).sort().join("; "), proposedValue: `${input.firstName} ${input.lastName}`,
        detail: "Another person has the same email, or the same name at the same Company.",
      }));
      continue;
    }

    const personaVerified = input.personaVerified && Boolean(input.persona);
    if (input.persona && !input.personaVerified) {
      plan.reviews.push(reviewItem({ ...base, recordId: targetId ?? null, reason: "persona_unverified", attribute: "persona", currentValue: null, proposedValue: text(input.persona), detail: "The persona is not verified, so it is not written." }));
    }
    const proposals = personProposals(input, personaVerified);

    if (!target) {
      const values: Record<string, unknown> = { company: [{ target_object: "companies", target_record_id: input.companyRecordId }] };
      const written: Record<string, string> = {};
      for (const proposal of [...proposals, ...stampProposals(input)]) {
        values[proposal.attribute] = proposal.write;
        written[proposal.attribute] = proposal.normalized;
      }
      plan.operations.push({ kind: "create", objectType: "people", recordId: null, sourceKey: input.sourceKey, values, written });
      continue;
    }

    const decided = decide("people", target, input.sourceKey, proposals, ledger);
    plan.reviews.push(...decided.reviews);
    // Never mark a persona verified while the persona itself is held for review.
    if (decided.reviews.some((item) => item.attribute === "persona")) {
      delete decided.values.persona_verified;
      delete decided.written.persona_verified;
    }
    if (Object.keys(decided.values).length === 0) continue;
    // Stamp provenance only when a substantive value is written.
    const stamps = decide("people", target, input.sourceKey, stampProposals(input), ledger);
    plan.reviews.push(...stamps.reviews);
    plan.operations.push({
      kind: "update", objectType: "people", recordId: target.id.record_id, sourceKey: input.sourceKey,
      values: { ...decided.values, ...stamps.values }, written: { ...decided.written, ...stamps.written },
    });
  }
  return plan;
}

// ---- applying --------------------------------------------------------------

const recordResponse = z.object({ data: attioRecordSchema });

export class AttioWritebackClient {
  readonly #transport: WritebackTransport;

  constructor(transport: WritebackTransport) {
    this.#transport = transport;
  }

  async createPerson(values: Record<string, unknown>): Promise<AttioRecord> {
    return recordResponse.parse(await this.#transport.send({ method: "POST", url: "/v2/objects/people/records", body: { data: { values } } })).data;
  }

  async updateRecord(objectType: WritebackObject, recordId: string, values: Record<string, unknown>): Promise<AttioRecord> {
    return recordResponse.parse(
      await this.#transport.send({
        method: "PATCH",
        url: `/v2/objects/${objectType}/records/${encodeURIComponent(recordId)}`,
        body: { data: { values } },
      }),
    ).data;
  }
}

export interface WritebackReport {
  dryRun: boolean;
  plan: WritebackPlan;
  created: number;
  updated: number;
  reviewsQueued: number;
  reviewsAlreadyQueued: number;
}

export interface WritebackRun {
  connectionId: string;
  state: AttioState;
  companies: CompanyEnrichment[];
  people: PersonEnrichment[];
  store: WritebackStore;
  // Required unless dryRun; a dry run never touches the transport or the store.
  client?: AttioWritebackClient;
  dryRun?: boolean;
}

export async function runWriteback(run: WritebackRun): Promise<WritebackReport> {
  const ledger = await run.store.loadLedger(run.connectionId);
  const plan = planWriteback(run.state, run.companies, run.people, ledger);
  const report: WritebackReport = { dryRun: run.dryRun === true, plan, created: 0, updated: 0, reviewsQueued: 0, reviewsAlreadyQueued: 0 };
  if (run.dryRun) return report;
  if (!run.client) throw new Error("A writeback client is required unless dryRun is set.");

  for (const operation of plan.operations) {
    if (operation.kind === "create") {
      const record = await run.client.createPerson(operation.values);
      await run.store.recordCreated(run.connectionId, "people", operation.sourceKey, record.id.record_id);
      await run.store.recordWritten(run.connectionId, "people", record.id.record_id, operation.written);
      report.created += 1;
    } else {
      await run.client.updateRecord(operation.objectType, operation.recordId!, operation.values);
      await run.store.recordWritten(run.connectionId, operation.objectType, operation.recordId!, operation.written);
      report.updated += 1;
    }
  }
  for (const item of plan.reviews) {
    if (await run.store.enqueueReview(run.connectionId, item)) report.reviewsQueued += 1;
    else report.reviewsAlreadyQueued += 1;
  }
  return report;
}

export class InMemoryWritebackStore implements WritebackStore {
  readonly written = new Map<string, string>();
  readonly created = new Map<string, string>();
  readonly reviews = new Map<string, ReviewItem>();

  async loadLedger(): Promise<LedgerSnapshot> {
    return { written: new Map(this.written), created: new Map(this.created) };
  }

  async recordCreated(_connectionId: string, objectType: WritebackObject, sourceKey: string, recordId: string): Promise<void> {
    this.created.set(`${objectType}:${sourceKey}`, recordId);
  }

  async recordWritten(_connectionId: string, objectType: WritebackObject, recordId: string, written: Record<string, string>): Promise<void> {
    for (const [attribute, value] of Object.entries(written)) this.written.set(`${objectType}:${recordId}:${attribute}`, value);
  }

  async enqueueReview(_connectionId: string, item: ReviewItem): Promise<boolean> {
    if (this.reviews.has(item.key)) return false;
    this.reviews.set(item.key, item);
    return true;
  }
}
