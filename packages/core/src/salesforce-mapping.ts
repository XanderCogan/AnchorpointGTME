import type {
  Activity,
  AuditConfig,
  Company,
  Contact,
  Deal,
  FixtureRelease,
  Owner,
  Task,
} from "./types.ts";

// Maps a frozen snapshot of the read-only Salesforce mirror onto the CRM-neutral
// audit model, so the Milestone 1 rules in audit.ts run unchanged (decision 0005).
// Salesforce has no standard field for several audit concepts; those come from
// configurable custom fields, and any mapped field missing from the payloads is
// reported rather than silently defaulted.

export type SalesforceRecordPayload = Record<string, unknown> & { Id: string };

export type SnapshotObjectKey = "account" | "site" | "contact" | "lead" | "opportunity" | "user" | "task" | "campaign";

export interface SalesforceSnapshot {
  // "synthetic-test-fixture" outputs are test results and are never findings.
  provenance: "synthetic-test-fixture" | "client-mirror";
  label: string;
  window: { start: string; end: string };
  records: Partial<Record<SnapshotObjectKey, SalesforceRecordPayload[]>>;
}

type Pipeline = Deal["pipeline"];
type OpenStage = Exclude<Deal["stage"], "closed_won" | "closed_lost">;

export interface SalesforceAuditMapping {
  release: string;
  healthRuleVersion: string;
  config: AuditConfig;
  // Account.Type values. Anything unlisted maps to "unknown".
  customerAccountTypes: readonly string[];
  formerCustomerAccountTypes: readonly string[];
  prospectAccountTypes: readonly string[];
  // BillingState inside the serviced footprint. A missing state is unknown geography.
  servicedStates: readonly string[];
  // Opportunity.Type to neutral pipeline; a null or unlisted Type uses defaultPipeline.
  pipelineByOpportunityType: Readonly<Record<string, Pipeline>>;
  defaultPipeline: Pipeline;
  openStageByStageName: Readonly<Record<string, OpenStage>>;
  // Integration users and queues own records without being accountable people.
  unaccountableUserIds: readonly string[];
  siteAccountField: string;
  customFields: {
    targetCandidate: string;
    persona: string;
    emailStatus: string;
    phoneStatus: string;
    enrichmentVerifiedAt: string;
    lifecycleStage: string;
  };
}

export const defaultCustomFields: SalesforceAuditMapping["customFields"] = {
  targetCandidate: "Target_Candidate__c",
  persona: "Persona__c",
  emailStatus: "Email_Status__c",
  phoneStatus: "Phone_Status__c",
  enrichmentVerifiedAt: "Enrichment_Verified_At__c",
  lifecycleStage: "Lifecycle_Stage__c",
};

export interface MappingGap {
  object: SnapshotObjectKey;
  field: string;
  recordsMissingField: number;
}

export interface SalesforceAuditInput {
  release: FixtureRelease;
  // Mapped fields absent from at least one payload. Each one falls back to a
  // conservative default (blocked channel, not a target) and must be resolved
  // by adding the field to the org and the connector field list.
  gaps: MappingGap[];
}

// Salesforce returns "+0000" offsets; normalize to ISO-8601 UTC. Date-only
// values (ActivityDate, CloseDate) are taken as UTC midnight.
export function salesforceInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const withColon = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(withColon) ? `${withColon}T00:00:00Z` : withColon);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function text(record: SalesforceRecordPayload, field: string): string | null {
  const value = record[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function flag(record: SalesforceRecordPayload, field: string): boolean {
  return record[field] === true;
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

export function mapSalesforceToAuditRelease(
  snapshot: SalesforceSnapshot,
  mapping: SalesforceAuditMapping,
): SalesforceAuditInput {
  const records = (key: SnapshotObjectKey) => snapshot.records[key] ?? [];
  const gaps: MappingGap[] = [];
  const noteGaps = (object: SnapshotObjectKey, fields: readonly string[]) => {
    for (const field of fields) {
      const missing = records(object).filter((record) => !(field in record)).length;
      if (missing > 0) gaps.push({ object, field, recordsMissingField: missing });
    }
  };
  const custom = mapping.customFields;
  noteGaps("account", ["Type", "BillingState", "Website", "OwnerId", custom.targetCandidate]);
  noteGaps("site", [mapping.siteAccountField]);
  noteGaps("contact", [
    "AccountId",
    "OwnerId",
    "Email",
    "Phone",
    "HasOptedOutOfEmail",
    "DoNotCall",
    custom.targetCandidate,
    custom.persona,
    custom.emailStatus,
    custom.phoneStatus,
    custom.enrichmentVerifiedAt,
    custom.lifecycleStage,
  ]);
  noteGaps("opportunity", ["AccountId", "OwnerId", "StageName", "Type", "IsClosed", "IsWon", "NextStep"]);
  noteGaps("task", ["WhoId", "WhatId", "AccountId", "OwnerId", "Status", "ActivityDate", "TaskSubtype", "CallDisposition"]);

  const users = records("user");
  const owners: Owner[] = users.map((user) => ({
    id: user.Id,
    name: text(user, "Name") ?? user.Id,
    active: flag(user, "IsActive"),
  }));
  const accountableUserIds = new Set(
    owners.filter((owner) => owner.active && !mapping.unaccountableUserIds.includes(owner.id)).map((owner) => owner.id),
  );
  const accountableOwner = (record: SalesforceRecordPayload): string | null => {
    const ownerId = text(record, "OwnerId");
    return ownerId && accountableUserIds.has(ownerId) ? ownerId : null;
  };

  const siteCounts = new Map<string, number>();
  for (const site of records("site")) {
    const accountId = text(site, mapping.siteAccountField);
    if (accountId) siteCounts.set(accountId, (siteCounts.get(accountId) ?? 0) + 1);
  }

  const customerStatus = (type: string | null): Company["customerStatus"] => {
    if (type === null) return "unknown";
    if (mapping.customerAccountTypes.includes(type)) return "current";
    if (mapping.formerCustomerAccountTypes.includes(type)) return "former";
    if (mapping.prospectAccountTypes.includes(type)) return "prospect";
    return "unknown";
  };

  const companies: Company[] = records("account").map((account) => {
    const state = text(account, "BillingState");
    return {
      id: account.Id,
      name: text(account, "Name") ?? account.Id,
      domain: text(account, "Website"),
      // Deleted records are not mirrored yet, so nothing in a snapshot is archived.
      archived: false,
      customerStatus: customerStatus(text(account, "Type")),
      serviceableGeography: state === null ? null : mapping.servicedStates.includes(state.toUpperCase()),
      state,
      industrySegment: text(account, "Industry"),
      // Sites are serviced locations, not accounts; no recorded site means the band is unknown.
      locationCount: siteCounts.get(account.Id) ?? null,
      ownerId: accountableOwner(account),
      targetCandidate: flag(account, custom.targetCandidate),
      lastModifiedAt: salesforceInstant(account.LastModifiedDate) ?? "",
    };
  });

  const contacts: Contact[] = records("contact").map((contact) => {
    const email = text(contact, "Email");
    const phone = text(contact, "Phone");
    const emailStatus = text(contact, custom.emailStatus)?.toLowerCase() as Contact["emailStatus"] | undefined;
    const phoneStatus = text(contact, custom.phoneStatus)?.toLowerCase() as Contact["phoneStatus"] | undefined;
    const lifecycle = text(contact, custom.lifecycleStage)?.toLowerCase();
    return {
      id: contact.Id,
      firstName: text(contact, "FirstName") ?? "",
      lastName: text(contact, "LastName") ?? "",
      companyId: text(contact, "AccountId"),
      title: text(contact, "Title"),
      persona: text(contact, custom.persona),
      ownerId: accountableOwner(contact),
      email,
      // An absent or unrecognized status is never promoted to verified.
      emailStatus: email === null ? "missing" : emailStatus && emailStatuses.has(emailStatus) ? emailStatus : "unverified",
      emailUnsubscribed: flag(contact, "HasOptedOutOfEmail"),
      phone,
      phoneStatus: phone === null ? "missing" : phoneStatus && phoneStatuses.has(phoneStatus) ? phoneStatus : "unverified",
      doNotCall: flag(contact, "DoNotCall"),
      targetCandidate: flag(contact, custom.targetCandidate),
      ...(lifecycle && lifecycleStages.has(lifecycle) ? { lifecycleStage: lifecycleStages.get(lifecycle) } : {}),
      lastEnrichmentVerifiedAt: salesforceInstant(contact[custom.enrichmentVerifiedAt]),
      lastModifiedAt: salesforceInstant(contact.LastModifiedDate) ?? "",
    };
  });

  const deals: Deal[] = records("opportunity").map((opportunity) => {
    const type = text(opportunity, "Type");
    const stageName = text(opportunity, "StageName") ?? "";
    const closed = flag(opportunity, "IsClosed");
    return {
      id: opportunity.Id,
      name: text(opportunity, "Name") ?? opportunity.Id,
      companyId: text(opportunity, "AccountId"),
      ownerId: accountableOwner(opportunity),
      pipeline: (type && mapping.pipelineByOpportunityType[type]) || mapping.defaultPipeline,
      stage: closed
        ? flag(opportunity, "IsWon")
          ? "closed_won"
          : "closed_lost"
        : (mapping.openStageByStageName[stageName] ?? "qualification"),
      nextStep: text(opportunity, "NextStep"),
      archived: false,
      lastModifiedAt: salesforceInstant(opportunity.LastModifiedDate) ?? "",
    };
  });

  const accountIds = new Set(companies.map((company) => company.id));
  const contactIds = new Set(contacts.map((contact) => contact.id));
  const opportunityIds = new Set(deals.map((deal) => deal.id));
  const activities: Activity[] = [];
  const tasks: Task[] = [];
  for (const task of records("task")) {
    const whatId = text(task, "WhatId");
    const whoId = text(task, "WhoId");
    const dealId = whatId && opportunityIds.has(whatId) ? whatId : null;
    const accountId = text(task, "AccountId") ?? (whatId && accountIds.has(whatId) ? whatId : null);
    const activityDate = salesforceInstant(task.ActivityDate);
    if (text(task, "Status") === "Completed") {
      const subtype = text(task, "TaskSubtype");
      const isCall = subtype === "Call";
      activities.push({
        id: task.Id,
        type: isCall ? "call" : subtype === "Email" ? "sales_email" : "completed_task",
        occurredAt: salesforceInstant(task.CompletedDateTime) ?? activityDate ?? "",
        companyId: accountId,
        contactId: whoId && contactIds.has(whoId) ? whoId : null,
        dealId,
        ...(isCall ? { requiresDisposition: true, outcome: text(task, "CallDisposition") } : {}),
      });
    } else {
      tasks.push({ id: task.Id, ownerId: accountableOwner(task), dealId, dueAt: activityDate ?? "", status: "open" });
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
