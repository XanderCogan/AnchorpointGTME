// Salesforce objects mirrored by the read-only connector, following the object
// mapping in docs/decisions/0005-crm-system-of-record.md.

export type SalesforceObjectKey =
  | "account"
  | "site"
  | "contact"
  | "lead"
  | "opportunity"
  | "user"
  | "task"
  | "campaign";

export interface SalesforceObjectSpec {
  key: SalesforceObjectKey;
  apiName: string;
  fields: readonly string[];
}

// Every mirrored object must expose these so source timestamps survive the sync.
export const timestampFields = ["CreatedDate", "LastModifiedDate", "SystemModstamp"] as const;

// Sync order puts referenced objects first so a mirror read mid-run is less surprising.
export const syncOrder: readonly SalesforceObjectKey[] = [
  "user",
  "account",
  "site",
  "contact",
  "lead",
  "campaign",
  "opportunity",
  "task",
];

const standardFields: Record<Exclude<SalesforceObjectKey, "site">, readonly string[]> = {
  account: ["Id", "Name", "ParentId", "OwnerId", "Type", "Industry", "BillingCity", "BillingState", "Website"],
  contact: [
    "Id",
    "AccountId",
    "FirstName",
    "LastName",
    "Title",
    "Email",
    "Phone",
    "HasOptedOutOfEmail",
    "DoNotCall",
    "OwnerId",
  ],
  lead: [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Email",
    "Status",
    "LeadSource",
    "IsConverted",
    "ConvertedAccountId",
    "ConvertedContactId",
    "HasOptedOutOfEmail",
    "DoNotCall",
    "OwnerId",
  ],
  opportunity: [
    "Id",
    "AccountId",
    "Name",
    "StageName",
    "Type",
    "Amount",
    "CloseDate",
    "IsClosed",
    "IsWon",
    "CampaignId",
    "LeadSource",
    "NextStep",
    "OwnerId",
  ],
  user: ["Id", "Name", "Email", "IsActive"],
  task: [
    "Id",
    "WhoId",
    "WhatId",
    "AccountId",
    "OwnerId",
    "Subject",
    "Status",
    "ActivityDate",
    "TaskSubtype",
    "CallDisposition",
    "CompletedDateTime",
  ],
  campaign: ["Id", "Name", "Type", "Status", "IsActive", "StartDate", "EndDate", "ParentId", "OwnerId"],
};

// The Site custom object is not created yet. Decision 0005 leaves open whether it
// is a custom object or Field Service Location, so its API name and fields are
// provisional and overridable until the Developer Edition org exists.
export const defaultSiteObjectApiName = "Site__c";
const defaultSiteFields = ["Id", "Name", "Account__c"] as const;

export function objectSpecs(options: {
  siteObjectApiName?: string;
  siteFields?: readonly string[];
} = {}): SalesforceObjectSpec[] {
  const siteApiName = options.siteObjectApiName ?? defaultSiteObjectApiName;
  if (!/^[A-Za-z][A-Za-z0-9_]*__c$/.test(siteApiName)) {
    throw new Error(`Site object API name ${siteApiName} must be a custom object name ending in __c.`);
  }
  const fieldsFor = (key: SalesforceObjectKey): readonly string[] => {
    const base = key === "site" ? (options.siteFields ?? defaultSiteFields) : standardFields[key];
    return [...base, ...timestampFields];
  };
  return syncOrder.map((key) => ({
    key,
    apiName: key === "site" ? siteApiName : apiNames[key],
    fields: fieldsFor(key),
  }));
}

const apiNames: Record<Exclude<SalesforceObjectKey, "site">, string> = {
  account: "Account",
  contact: "Contact",
  lead: "Lead",
  opportunity: "Opportunity",
  user: "User",
  task: "Task",
  campaign: "Campaign",
};

// SOQL datetime literals are unquoted ISO-8601 values. Seconds precision keeps the
// literal in the documented form; callers truncate window bounds before calling.
export function soqlDateTime(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildWindowQuery(
  spec: SalesforceObjectSpec,
  window: { since: Date; until: Date; limit: number },
): string {
  for (const field of spec.fields) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) throw new Error(`Invalid field name ${field}.`);
  }
  return [
    `SELECT ${spec.fields.join(", ")}`,
    `FROM ${spec.apiName}`,
    `WHERE SystemModstamp >= ${soqlDateTime(window.since)} AND SystemModstamp <= ${soqlDateTime(window.until)}`,
    "ORDER BY SystemModstamp ASC, Id ASC",
    `LIMIT ${window.limit}`,
  ].join(" ");
}
