// One-time derivation of the synthetic Attio fixtures from salesforce-mapping-v1
// (decision 0011). Each Salesforce record becomes the Attio record a migration
// would produce, with a deterministic UUID, so the expected findings carry over
// rule for rule. Outputs are synthetic test inputs only, never findings.
//
//   node scripts/derive-attio-fixtures.ts
//
// Once tests depend on the outputs they are frozen; change them only through a
// new release, never by rerunning this over them.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Sf = Record<string, unknown> & { Id: string };

const root = resolve(import.meta.dirname, "..");
const source = JSON.parse(
  readFileSync(resolve(root, "fixtures/releases/salesforce-mapping-v1/input/salesforce.json"), "utf8"),
) as { mapping: Record<string, unknown>; snapshot: { window: unknown; records: Record<string, Sf[]> } };
const sfExpected = JSON.parse(
  readFileSync(resolve(root, "fixtures/releases/salesforce-mapping-v1/expected/findings.json"), "utf8"),
) as { affectedIds: string[] }[];

const workspaceId = uuid("workspace");
const objectIds = Object.fromEntries(
  ["companies", "people", "deals", "sites", "calls"].map((slug) => [slug, uuid(`object:${slug}`)]),
);

function uuid(seed: string): string {
  const hex = createHash("sha256").update(`attio-fixture:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const iso = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const withColon = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(withColon) ? `${withColon}T00:00:00Z` : withColon).toISOString();
};

const actor = { type: "system", id: null };

function recordBuilder(record: Sf) {
  const activeFrom = iso(record.LastModifiedDate)!;
  const meta = { active_from: activeFrom, active_until: null, created_by_actor: actor };
  const values: Record<string, Record<string, unknown>[]> = {};
  const put = (slug: string, field: string, make: (value: unknown) => Record<string, unknown> | null) => {
    if (!(field in record)) return;
    const value = record[field];
    const made = value === null || value === undefined ? null : make(value);
    values[slug] = made ? [{ ...meta, ...made }] : [];
  };
  return { values, put };
}

const t = (attribute_type: string) => (value: unknown) => ({ value, attribute_type });
const option = (value: unknown) => ({
  option: { id: { workspace_id: workspaceId, option_id: uuid(`option:${String(value)}`) }, title: value, is_archived: false },
  attribute_type: "select",
});
const ref = (target: string) => (value: unknown) => ({
  target_object: target,
  target_record_id: uuid(String(value)),
  attribute_type: "record-reference",
});
const member = (value: unknown) => ({
  referenced_actor_type: "workspace-member",
  referenced_actor_id: uuid(String(value)),
  attribute_type: "actor-reference",
});

function wrap(slug: string, record: Sf, values: Record<string, unknown>) {
  return {
    id: { workspace_id: workspaceId, object_id: objectIds[slug], record_id: uuid(record.Id) },
    created_at: iso(record.CreatedDate),
    web_url: `https://app.attio.com/synthetic-fixture/${slug}/${uuid(record.Id)}`,
    values,
  };
}

const sf = source.snapshot.records;

const members = (sf.user ?? []).map((user) => {
  const [firstName, ...rest] = String(user.Name).split(" ");
  return {
    id: { workspace_id: workspaceId, workspace_member_id: uuid(user.Id) },
    first_name: firstName,
    last_name: rest.join(" "),
    avatar_url: null,
    email_address: user.Email,
    access_level: user.IsActive ? "member" : "suspended",
    created_at: iso(user.CreatedDate),
  };
});

const companies = (sf.account ?? []).map((account) => {
  const { values, put } = recordBuilder(account);
  put("name", "Name", t("text"));
  put("domains", "Website", (value) => {
    const domain = String(value).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return { domain, root_domain: domain, attribute_type: "domain" };
  });
  put("customer_status", "Type", option);
  put("owner", "OwnerId", member);
  put("target_candidate", "Target_Candidate__c", t("checkbox"));
  put("industry_segment", "Industry", option);
  put("parent_company", "ParentId", ref("companies"));
  put("primary_location", "BillingState", (value) => ({
    line_1: null, line_2: null, line_3: null, line_4: null,
    locality: account.BillingCity ?? null, region: value, postcode: null, country_code: "US",
    latitude: null, longitude: null, attribute_type: "location",
  }));
  return wrap("companies", account, values);
});

const sites = (sf.site ?? []).map((site) => {
  const { values, put } = recordBuilder(site);
  put("name", "Name", t("text"));
  put("company", "Account__c", ref("companies"));
  return wrap("sites", site, values);
});

const people = (sf.contact ?? []).map((contact) => {
  const { values, put } = recordBuilder(contact);
  put("name", "LastName", () => ({
    first_name: contact.FirstName ?? "",
    last_name: contact.LastName ?? "",
    full_name: [contact.FirstName, contact.LastName].filter(Boolean).join(" "),
    attribute_type: "personal-name",
  }));
  put("company", "AccountId", ref("companies"));
  put("job_title", "Title", t("text"));
  put("owner", "OwnerId", member);
  put("email_addresses", "Email", (value) => ({
    original_email_address: value, email_address: value, email_domain: String(value).split("@")[1],
    email_root_domain: String(value).split("@")[1], email_local_specifier: String(value).split("@")[0],
    attribute_type: "email-address",
  }));
  put("phone_numbers", "Phone", (value) => ({
    original_phone_number: value, country_code: "US", phone_number: String(value).replace(/[^+\d]/g, ""),
    attribute_type: "phone-number",
  }));
  put("email_opt_out", "HasOptedOutOfEmail", t("checkbox"));
  put("do_not_call", "DoNotCall", t("checkbox"));
  put("target_candidate", "Target_Candidate__c", t("checkbox"));
  put("persona", "Persona__c", option);
  put("email_status", "Email_Status__c", option);
  put("phone_status", "Phone_Status__c", option);
  put("enrichment_verified_at", "Enrichment_Verified_At__c", (value) => ({ value: iso(value), attribute_type: "timestamp" }));
  put("lifecycle_stage", "Lifecycle_Stage__c", option);
  return wrap("people", contact, values);
});

const stageTitle = (opportunity: Sf) =>
  opportunity.IsClosed ? (opportunity.IsWon ? "Won 🎉" : "Lost") : opportunity.StageName;

const deals = (sf.opportunity ?? []).map((opportunity) => {
  const { values, put } = recordBuilder(opportunity);
  put("name", "Name", t("text"));
  put("stage", "StageName", () => ({
    status: { id: { workspace_id: workspaceId, status_id: uuid(`status:${stageTitle(opportunity)}`) }, title: stageTitle(opportunity), is_archived: false },
    attribute_type: "status",
  }));
  put("owner", "OwnerId", member);
  put("value", "Amount", (value) => ({ currency_value: value, currency_code: "USD", attribute_type: "currency" }));
  put("associated_company", "AccountId", ref("companies"));
  put("deal_type", "Type", option);
  put("next_step", "NextStep", t("text"));
  return wrap("deals", opportunity, values);
});

// Completed Salesforce call tasks become call-log records; other tasks stay tasks.
const sfTasks = sf.task ?? [];
const isCall = (task: Sf) => task.TaskSubtype === "Call" && task.Status === "Completed";
const calls = sfTasks.filter(isCall).map((task) => {
  const { values, put } = recordBuilder(task);
  put("occurred_at", "CompletedDateTime", (value) => ({ value: iso(value), attribute_type: "timestamp" }));
  put("disposition", "CallDisposition", option);
  put("company", "AccountId", ref("companies"));
  put("person", "WhoId", ref("people"));
  put("deal", "WhatId", (value) => (String(value).startsWith("006") ? ref("deals")(value) : null));
  put("owner", "OwnerId", member);
  return wrap("calls", task, values);
});
const tasks = sfTasks.filter((task) => !isCall(task)).map((task) => ({
  id: { workspace_id: workspaceId, task_id: uuid(task.Id) },
  content_plaintext: task.Subject,
  format: "plaintext",
  deadline_at: iso(task.ActivityDate),
  is_completed: task.Status === "Completed",
  linked_records: [task.WhatId, task.AccountId]
    .filter((id): id is string => typeof id === "string")
    .map((id) => ({
      target_object_id: objectIds[id.startsWith("006") ? "deals" : "companies"],
      target_record_id: uuid(id),
    })),
  assignees: [{ referenced_actor_type: "workspace-member", referenced_actor_id: uuid(String(task.OwnerId)) }],
  created_by_actor: actor,
  created_at: iso(task.CreatedDate),
}));

const sfMapping = source.mapping as Record<string, unknown>;
const mapping = {
  release: "attio-mapping-v1",
  healthRuleVersion: sfMapping.healthRuleVersion,
  config: sfMapping.config,
  customerStatuses: sfMapping.customerAccountTypes,
  formerCustomerStatuses: sfMapping.formerCustomerAccountTypes,
  prospectStatuses: sfMapping.prospectAccountTypes,
  servicedRegions: sfMapping.servicedStates,
  pipelineByDealType: sfMapping.pipelineByOpportunityType,
  defaultPipeline: sfMapping.defaultPipeline,
  openStageByStatus: sfMapping.openStageByStageName,
  wonStatuses: ["Won 🎉"],
  lostStatuses: ["Lost"],
  unaccountableMemberIds: (sfMapping.unaccountableUserIds as string[]).map(uuid),
  attributes: {
    company: { customerStatus: "customer_status", owner: "owner", targetCandidate: "target_candidate", industry: "industry_segment", location: "primary_location" },
    person: {
      name: "name", company: "company", jobTitle: "job_title", owner: "owner", email: "email_addresses", phone: "phone_numbers",
      emailOptOut: "email_opt_out", doNotCall: "do_not_call", targetCandidate: "target_candidate", persona: "persona",
      emailStatus: "email_status", phoneStatus: "phone_status", enrichmentVerifiedAt: "enrichment_verified_at", lifecycleStage: "lifecycle_stage",
    },
    deal: { company: "associated_company", owner: "owner", stage: "stage", type: "deal_type", nextStep: "next_step" },
    site: { company: "company" },
    call: { occurredAt: "occurred_at", disposition: "disposition", company: "company", person: "person", deal: "deal" },
  },
};

function write(path: string, value: unknown, inline = false): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  if (existsSync(target)) throw new Error(`${path} exists; fixtures are frozen once written.`);
  writeFileSync(target, inline ? value as string : `${JSON.stringify(value, null, 2)}\n`);
}

write("fixtures/releases/attio-mapping-v1/input/attio.json", {
  synthetic: true,
  note: "Hand-designed synthetic Attio-shaped audit fixture, derived record for record from salesforce-mapping-v1 by scripts/derive-attio-fixtures.ts. Fictional records on reserved .example domains; test input only, never findings or market evidence.",
  mapping,
  snapshot: {
    provenance: "synthetic-test-fixture",
    label: "attio-mapping-v1",
    window: source.snapshot.window,
    records: { member: members, company: companies, site: sites, person: people, deal: deals, call: calls, task: tasks },
  },
});

const expectedLines = sfExpected.map((finding) =>
  `  ${JSON.stringify({ ...finding, affectedIds: finding.affectedIds.map(uuid).sort() })}`,
);
write("fixtures/releases/attio-mapping-v1/expected/findings.json", `[\n${expectedLines.join(",\n")}\n]\n`, true);

// Recorded connector responses: the same records served in pages of five.
const pageSize = 5;
const recorded = "fixtures/connectors/attio-recorded-v1";
const responses: { method: string; path: string; offset: number; file: string }[] = [];
const pages = (name: string, method: string, path: string, items: unknown[]) => {
  for (let offset = 0; offset === 0 || offset < items.length; offset += pageSize) {
    const file = `${name}-${offset / pageSize + 1}.json`;
    write(`${recorded}/initial/${file}`, { data: items.slice(offset, offset + pageSize) });
    responses.push({ method, path, offset, file });
  }
};
write(`${recorded}/initial/workspace-members.json`, { data: members });
responses.push({ method: "GET", path: "/v2/workspace_members", offset: 0, file: "workspace-members.json" });
pages("companies", "POST", "/v2/objects/companies/records/query", companies);
pages("sites", "POST", "/v2/objects/sites/records/query", sites);
pages("people", "POST", "/v2/objects/people/records/query", people);
pages("deals", "POST", "/v2/objects/deals/records/query", deals);
pages("calls", "POST", "/v2/objects/calls/records/query", calls);
pages("tasks", "GET", "/v2/tasks", tasks);
const note = "SYNTHETIC. Hand-written responses shaped like the Attio REST API, derived from salesforce-mapping-v1. Not recorded from any workspace; no real people or customers.";
write(`${recorded}/initial/manifest.json`, { synthetic: true, note, baseUrl: "https://attio-synthetic.example", responses });

// A later run: the first company is renamed and every other record is unchanged.
const changedCompanies = structuredClone(companies);
const renamed = changedCompanies[0]!;
renamed.values.name = [{ active_from: "2026-10-10T12:00:00.000Z", active_until: null, created_by_actor: actor, value: "Clean Fixture Operator (renamed)", attribute_type: "text" }];
write(`${recorded}/changed/companies-1.json`, { data: changedCompanies.slice(0, pageSize) });
write(`${recorded}/changed/manifest.json`, {
  synthetic: true,
  note: `${note} Same as initial except one renamed company.`,
  baseUrl: "https://attio-synthetic.example",
  responses: responses.map((entry) =>
    entry.file === "companies-1.json" ? entry : { ...entry, file: `../initial/${entry.file}` },
  ),
});
console.log(`Wrote attio-mapping-v1 and ${recorded} (${responses.length} recorded responses).`);
