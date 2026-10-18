export type Severity = "critical" | "warning" | "informational";
export type ObjectType = "company" | "contact" | "deal" | "activity" | "integration_event";

export interface Owner {
  id: string;
  name: string;
  active: boolean;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  archived: boolean;
  customerStatus: "current" | "former" | "prospect" | "unknown";
  serviceableGeography: boolean | null;
  state: string | null;
  industrySegment: string | null;
  locationCount: number | null;
  ownerId: string | null;
  targetCandidate: boolean;
  lastModifiedAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
  title: string | null;
  persona: string | null;
  ownerId: string | null;
  email: string | null;
  emailStatus: "verified" | "invalid" | "unverified" | "missing";
  emailUnsubscribed: boolean;
  phone: string | null;
  phoneStatus: "verified" | "unverified" | "missing";
  doNotCall: boolean;
  targetCandidate: boolean;
  lifecycleStage?: "subscriber" | "lead" | "marketing_qualified_lead" | "sales_qualified_lead" | "opportunity" | "customer";
  lastEnrichmentVerifiedAt: string | null;
  lastModifiedAt: string;
}

export interface Deal {
  id: string;
  name: string;
  companyId: string | null;
  ownerId: string | null;
  pipeline: "new_business" | "implementation" | "renewal" | "support";
  stage: "qualification" | "evaluation" | "proposal" | "closed_won" | "closed_lost";
  nextStep: string | null;
  archived: boolean;
  lastModifiedAt: string;
}

export interface Activity {
  id: string;
  type: "call" | "sales_email" | "prospect_reply" | "meeting" | "completed_task" | "note" | "marketing_event";
  occurredAt: string;
  companyId: string | null;
  contactId: string | null;
  dealId: string | null;
  requiresDisposition?: boolean;
  outcome?: string | null;
}

export interface Task {
  id: string;
  ownerId: string | null;
  dealId: string | null;
  dueAt: string;
  status: "open" | "complete";
}

export interface AuditConfig {
  asOf: string;
  reportingTimeZone: string;
  staleDealDays: number;
  staleContactDays: number;
  newBusinessPipeline: string;
}

export interface FixtureRelease {
  release: string;
  healthRuleVersion: string;
  config: AuditConfig;
  owners: Owner[];
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  tasks: Task[];
}

export interface Finding {
  findingId: string;
  ruleId: string;
  severity: Severity;
  objectType: ObjectType;
  affectedIds: string[];
  evidence: Record<string, unknown>;
  proposedRemediation: string;
  automationSafety: "read-only" | "propose-only" | "reversible" | "manual-only";
  detectedAt: string;
  ruleVersion: string;
}

export interface FindingExpectation {
  ruleId: string;
  severity: Severity;
  objectType: ObjectType;
  affectedIds: string[];
}

