import { createHash } from "node:crypto";
import type { Activity, AuditConfig, Company, Contact, Deal, FixtureRelease, Owner, Task } from "./types.ts";

// Maps a frozen snapshot of the read-only Attio mirror onto the CRM-neutral audit
// model, so the Milestone 1 rules in audit.ts run unchanged (decision 0011).
// Attio has no standard attribute for several audit concepts (owner on companies
// and people, suppression, persona, statuses); those come from configurable
// attribute slugs, and any mapped attribute missing from the payloads is reported
// rather than silently defaulted.

type AttributeValue = Record<string, unknown> & { active_from?: string | null };

export interface AttioRecordPayload {
  id: { record_id: string } & Record<string, unknown>;
  created_at: string;
  values: Record<string, AttributeValue[]>;
}

export interface AttioMemberPayload {
  id: { workspace_member_id: string } & Record<string, unknown>;
  first_name: string | null;
  last_name: string | null;
  email_address: string | null;
  access_level: string;
  created_at: string;
}

export interface AttioTaskPayload {
  id: { task_id: string } & Record<string, unknown>;
  content_plaintext?: string | null;
  deadline_at: string | null;
  is_completed: boolean;
  linked_records: { target_object_id: string; target_record_id: string }[];
  assignees: { referenced_actor_type: string; referenced_actor_id: string }[];
  created_at: string;
}

export type AttioSnapshotKey = "member" | "company" | "site" | "person" | "deal" | "call" | "task";

export interface AttioSnapshot {
  // "synthetic-test-fixture" outputs are test results and are never findings.
  provenance: "synthetic-test-fixture" | "client-mirror";
  label: string;
  window: { start: string; end: string };
  records: {
    member?: AttioMemberPayload[];
    company?: AttioRecordPayload[];
    site?: AttioRecordPayload[];
    person?: AttioRecordPayload[];
    deal?: AttioRecordPayload[];
    call?: AttioRecordPayload[];
    task?: AttioTaskPayload[];
  };
}

type Pipeline = Deal["pipeline"];
type OpenStage = Exclude<Deal["stage"], "closed_won" | "closed_lost">;

export interface AttioAttributeSlugs {
  company: { customerStatus: string; owner: string; targetCandidate: string; industry: string; location: string };
  person: {
    name: string;
    company: string;
    jobTitle: string;
    owner: string;
    email: string;
    phone: string;
    emailOptOut: string;
    doNotCall: string;
    targetCandidate: string;
    persona: string;
    emailStatus: string;
    phoneStatus: string;
    enrichmentVerifiedAt: string;
    lifecycleStage: string;
  };
  deal: { company: string; owner: string; stage: string; type: string; nextStep: string };
  site: { company: string };
  call: { occurredAt: string; disposition: string; company: string; person: string; deal: string };
}

// Standard Attio slugs where one exists (name, domains, primary_location,
// email_addresses, phone_numbers, job_title, company, and the deal owner,
// stage, and associated_company); the rest are custom attributes the
// workspace setup creates.
export const defaultAttributeSlugs: AttioAttributeSlugs = {
  company: {
    customerStatus: "customer_status",
    owner: "owner",
    targetCandidate: "target_candidate",
    industry: "industry_segment",
    location: "primary_location",
  },
  person: {
    name: "name",
    company: "company",
    jobTitle: "job_title",
    owner: "owner",
    email: "email_addresses",
    phone: "phone_numbers",
    emailOptOut: "email_opt_out",
    doNotCall: "do_not_call",
    targetCandidate: "target_candidate",
    persona: "persona",
    emailStatus: "email_status",
    phoneStatus: "phone_status",
    enrichmentVerifiedAt: "enrichment_verified_at",
    lifecycleStage: "lifecycle_stage",
  },
  deal: { company: "associated_company", owner: "owner", stage: "stage", type: "deal_type", nextStep: "next_step" },
  site: { company: "company" },
  call: { occurredAt: "occurred_at", disposition: "disposition", company: "company", person: "person", deal: "deal" },
};

export interface AttioAuditMapping {
  release: string;
  healthRuleVersion: string;
  config: AuditConfig;
  // customer_status option titles. Anything unlisted maps to "unknown".
  customerStatuses: readonly string[];
  formerCustomerStatuses: readonly string[];
  prospectStatuses: readonly string[];
  // primary_location region codes inside the serviced footprint. A missing region is unknown geography.
  servicedRegions: readonly string[];
  // deal_type option title to neutral pipeline; a missing or unlisted type uses defaultPipeline.
  pipelineByDealType: Readonly<Record<string, Pipeline>>;
  defaultPipeline: Pipeline;
  // Deal stage status titles.
  openStageByStatus: Readonly<Record<string, OpenStage>>;
  wonStatuses: readonly string[];
  lostStatuses: readonly string[];
  // Integration and shared members own records without being accountable people.
  unaccountableMemberIds: readonly string[];
  attributes: AttioAttributeSlugs;
}

export interface MappingGap {
  object: AttioSnapshotKey;
  field: string;
  recordsMissingField: number;
}

export interface AttioAuditInput {
  release: FixtureRelease;
  // Mapped attributes absent from at least one payload. Each one falls back to a
  // conservative default (blocked channel, not a target) and must be resolved
  // by creating the attribute in the workspace.
  gaps: MappingGap[];
}

export function attioInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function first(record: AttioRecordPayload, slug: string): AttributeValue | undefined {
  return record.values[slug]?.[0];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// Reads the display value of any supported attribute type.
function text(record: AttioRecordPayload, slug: string): string | null {
  const value = first(record, slug);
  if (!value) return null;
  const option = value.option as { title?: unknown } | undefined;
  const status = value.status as { title?: unknown } | undefined;
  return (
    str(value.value) ??
    str(option?.title) ??
    str(status?.title) ??
    str(value.domain) ??
    str(value.email_address) ??
    str(value.original_phone_number) ??
    str(value.region) ??
    null
  );
}

function checked(record: AttioRecordPayload, slug: string): boolean {
  return first(record, slug)?.value === true;
}

function recordRef(record: AttioRecordPayload, slug: string): string | null {
  return str(first(record, slug)?.target_record_id);
}

function memberRef(record: AttioRecordPayload, slug: string): string | null {
  const value = first(record, slug);
  return value?.referenced_actor_type === "workspace-member" ? str(value.referenced_actor_id) : null;
}

// Attio has no record-level modified timestamp; the latest active_from of any
// current value is when the record last changed.
function lastChangedAt(record: AttioRecordPayload): string {
  let latest = Date.parse(record.created_at);
  for (const values of Object.values(record.values)) {
    for (const value of values) {
      const at = Date.parse(value.active_from ?? "");
      if (Number.isFinite(at) && at > latest) latest = at;
    }
  }
  return Number.isFinite(latest) ? new Date(latest).toISOString() : "";
}

const emailStatuses = new Set<Contact["emailStatus"]>(["verified", "invalid", "unverified", "missing"]);
const phoneStatuses = new Set<Contact["phoneStatus"]>(["verified", "unverified", "missing"]);
const lifecycleStages = new Map<string, NonNullable<Contact["lifecycleStage"]>>([
  ["subscriber", "subscriber"],
  ["lead", "lead"],
  ["marketing qualified lead", "marketing_qualified_lead"],
  ["sales qualified lead", "sales_qualified_lead"],
  ["opportunity", "opportunity"],
  ["customer", "customer"],
]);

export function mapAttioToAuditRelease(snapshot: AttioSnapshot, mapping: AttioAuditMapping): AttioAuditInput {
  const slugs = mapping.attributes;
  const gaps: MappingGap[] = [];
  const noteGaps = (object: AttioSnapshotKey, records: readonly AttioRecordPayload[], fields: readonly string[]) => {
    for (const field of fields) {
      const missing = records.filter((record) => !(field in record.values)).length;
      if (missing > 0) gaps.push({ object, field, recordsMissingField: missing });
    }
  };
  const companyRecords = snapshot.records.company ?? [];
  const siteRecords = snapshot.records.site ?? [];
  const personRecords = snapshot.records.person ?? [];
  const dealRecords = snapshot.records.deal ?? [];
  const callRecords = snapshot.records.call ?? [];
  noteGaps("company", companyRecords, ["name", "domains", ...Object.values(slugs.company)]);
  noteGaps("site", siteRecords, Object.values(slugs.site));
  noteGaps("person", personRecords, Object.values(slugs.person));
  noteGaps("deal", dealRecords, ["name", ...Object.values(slugs.deal)]);
  noteGaps("call", callRecords, Object.values(slugs.call));

  const owners: Owner[] = (snapshot.records.member ?? []).map((member) => ({
    id: member.id.workspace_member_id,
    name: [member.first_name, member.last_name].filter(Boolean).join(" ") || member.id.workspace_member_id,
    active: member.access_level !== "suspended",
  }));
  const accountableIds = new Set(
    owners.filter((owner) => owner.active && !mapping.unaccountableMemberIds.includes(owner.id)).map((owner) => owner.id),
  );
  const accountable = (id: string | null): string | null => (id && accountableIds.has(id) ? id : null);

  const siteCounts = new Map<string, number>();
  for (const site of siteRecords) {
    const companyId = recordRef(site, slugs.site.company);
    if (companyId) siteCounts.set(companyId, (siteCounts.get(companyId) ?? 0) + 1);
  }

  const customerStatus = (status: string | null): Company["customerStatus"] => {
    if (status === null) return "unknown";
    if (mapping.customerStatuses.includes(status)) return "current";
    if (mapping.formerCustomerStatuses.includes(status)) return "former";
    if (mapping.prospectStatuses.includes(status)) return "prospect";
    return "unknown";
  };

  const companies: Company[] = companyRecords.map((company) => {
    const id = company.id.record_id;
    const region = text(company, slugs.company.location);
    return {
      id,
      name: text(company, "name") ?? id,
      domain: text(company, "domains"),
      // Deleted records are not mirrored, so nothing in a snapshot is archived.
      archived: false,
      customerStatus: customerStatus(text(company, slugs.company.customerStatus)),
      serviceableGeography: region === null ? null : mapping.servicedRegions.includes(region.toUpperCase()),
      state: region,
      industrySegment: text(company, slugs.company.industry),
      // Sites are serviced locations, not companies; no recorded site means the band is unknown.
      locationCount: siteCounts.get(id) ?? null,
      ownerId: accountable(memberRef(company, slugs.company.owner)),
      targetCandidate: checked(company, slugs.company.targetCandidate),
      lastModifiedAt: lastChangedAt(company),
    };
  });

  const p = slugs.person;
  const contacts: Contact[] = personRecords.map((person) => {
    const name = first(person, p.name);
    const email = text(person, p.email);
    const phone = text(person, p.phone);
    const emailStatus = text(person, p.emailStatus)?.toLowerCase() as Contact["emailStatus"] | undefined;
    const phoneStatus = text(person, p.phoneStatus)?.toLowerCase() as Contact["phoneStatus"] | undefined;
    const lifecycle = text(person, p.lifecycleStage)?.toLowerCase();
    return {
      id: person.id.record_id,
      firstName: str(name?.first_name) ?? "",
      lastName: str(name?.last_name) ?? "",
      companyId: recordRef(person, p.company),
      title: text(person, p.jobTitle),
      persona: text(person, p.persona),
      ownerId: accountable(memberRef(person, p.owner)),
      email,
      // An absent or unrecognized status is never promoted to verified.
      emailStatus: email === null ? "missing" : emailStatus && emailStatuses.has(emailStatus) ? emailStatus : "unverified",
      emailUnsubscribed: checked(person, p.emailOptOut),
      phone,
      phoneStatus: phone === null ? "missing" : phoneStatus && phoneStatuses.has(phoneStatus) ? phoneStatus : "unverified",
      doNotCall: checked(person, p.doNotCall),
      targetCandidate: checked(person, p.targetCandidate),
      ...(lifecycle && lifecycleStages.has(lifecycle) ? { lifecycleStage: lifecycleStages.get(lifecycle) } : {}),
      lastEnrichmentVerifiedAt: attioInstant(text(person, p.enrichmentVerifiedAt)),
      lastModifiedAt: lastChangedAt(person),
    };
  });

  const deals: Deal[] = dealRecords.map((deal) => {
    const id = deal.id.record_id;
    const type = text(deal, slugs.deal.type);
    const stage = text(deal, slugs.deal.stage) ?? "";
    return {
      id,
      name: text(deal, "name") ?? id,
      companyId: recordRef(deal, slugs.deal.company),
      ownerId: accountable(memberRef(deal, slugs.deal.owner)),
      pipeline: (type && mapping.pipelineByDealType[type]) || mapping.defaultPipeline,
      stage: mapping.wonStatuses.includes(stage)
        ? "closed_won"
        : mapping.lostStatuses.includes(stage)
          ? "closed_lost"
          : (mapping.openStageByStatus[stage] ?? "qualification"),
      nextStep: text(deal, slugs.deal.nextStep),
      archived: false,
      lastModifiedAt: lastChangedAt(deal),
    };
  });

  const companyIds = new Set(companies.map((company) => company.id));
  const contactIds = new Set(contacts.map((contact) => contact.id));
  const dealIds = new Set(deals.map((deal) => deal.id));
  const known = (ids: Set<string>, id: string | null) => (id && ids.has(id) ? id : null);

  // Calls are a custom call-log object; every call needs a disposition.
  const activities: Activity[] = callRecords.map((call) => ({
    id: call.id.record_id,
    type: "call",
    occurredAt: attioInstant(text(call, slugs.call.occurredAt)) ?? "",
    companyId: known(companyIds, recordRef(call, slugs.call.company)),
    contactId: known(contactIds, recordRef(call, slugs.call.person)),
    dealId: known(dealIds, recordRef(call, slugs.call.deal)),
    requiresDisposition: true,
    outcome: text(call, slugs.call.disposition),
  }));

  const tasks: Task[] = [];
  for (const task of snapshot.records.task ?? []) {
    const linked = task.linked_records.map((link) => link.target_record_id);
    const dealId = linked.find((id) => dealIds.has(id)) ?? null;
    if (task.is_completed) {
      // Attio records no completion time; the deadline, else creation, stands in.
      activities.push({
        id: task.id.task_id,
        type: "completed_task",
        occurredAt: attioInstant(task.deadline_at) ?? attioInstant(task.created_at) ?? "",
        companyId: linked.find((id) => companyIds.has(id)) ?? null,
        contactId: linked.find((id) => contactIds.has(id)) ?? null,
        dealId,
      });
    } else {
      const assignee = task.assignees.find((actor) => actor.referenced_actor_type === "workspace-member");
      tasks.push({
        id: task.id.task_id,
        ownerId: accountable(assignee?.referenced_actor_id ?? null),
        dealId,
        dueAt: attioInstant(task.deadline_at) ?? "",
        status: "open",
      });
    }
  }

  return {
    release: {
      release: mapping.release,
      healthRuleVersion: mapping.healthRuleVersion,
      config: mapping.config,
      owners,
      companies,
      contacts,
      deals,
      activities,
      tasks,
    },
    gaps,
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function attioSnapshotChecksum(snapshot: AttioSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot.records)).digest("hex");
}
