import type {
  Company,
  Contact,
  Deal,
  Finding,
  FixtureRelease,
  ObjectType,
  Severity,
} from "./types.ts";

const MATERIAL_ACTIVITY_TYPES = new Set([
  "call",
  "sales_email",
  "prospect_reply",
  "meeting",
  "completed_task",
]);

const CLOSED_STAGES = new Set(["closed_won", "closed_lost"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  const withoutProtocol = domain.trim().toLowerCase().replace(/^https?:\/\//, "");
  const [hostnamePart = ""] = withoutProtocol.split("/");
  const hostname = hostnamePart.replace(/^www\./, "").replace(/\.$/, "");
  return hostname || null;
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function isOpenNewBusinessDeal(deal: Deal): boolean {
  return !deal.archived && deal.pipeline === "new_business" && !CLOSED_STAGES.has(deal.stage);
}

function finding(
  release: FixtureRelease,
  ruleId: string,
  severity: Severity,
  objectType: ObjectType,
  affectedIds: string[],
  evidence: Record<string, unknown>,
  proposedRemediation: string,
  automationSafety: Finding["automationSafety"],
): Finding {
  const sortedIds = [...affectedIds].sort();
  return {
    findingId: `${ruleId}:${objectType}:${sortedIds.join("+")}`,
    ruleId,
    severity,
    objectType,
    affectedIds: sortedIds,
    evidence,
    proposedRemediation,
    automationSafety,
    detectedAt: release.config.asOf,
    ruleVersion: release.healthRuleVersion,
  };
}

function latestMaterialActivityAt(
  release: FixtureRelease,
  selector: { companyId?: string; contactId?: string; dealId?: string },
): string | null {
  const timestamps = release.activities
    .filter((activity) => MATERIAL_ACTIVITY_TYPES.has(activity.type))
    .filter((activity) => {
      if (selector.dealId) return activity.dealId === selector.dealId;
      if (selector.contactId) return activity.contactId === selector.contactId;
      if (selector.companyId) return activity.companyId === selector.companyId;
      return false;
    })
    .map((activity) => Date.parse(activity.occurredAt))
    .filter(Number.isFinite);

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function hasFutureOwnedTask(release: FixtureRelease, dealId: string): boolean {
  const asOf = Date.parse(release.config.asOf);
  return release.tasks.some(
    (task) =>
      task.dealId === dealId &&
      task.status === "open" &&
      task.ownerId !== null &&
      Date.parse(task.dueAt) > asOf,
  );
}

function contactReferenceAt(release: FixtureRelease, contact: Contact): string | null {
  const activityAt = latestMaterialActivityAt(release, { contactId: contact.id });
  const candidates = [activityAt, contact.lastEnrichmentVerifiedAt]
    .filter((value): value is string => Boolean(value))
    .map(Date.parse)
    .filter(Number.isFinite);

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

export function auditCrm(release: FixtureRelease): Finding[] {
  const findings: Finding[] = [];
  const companiesById = new Map(release.companies.map((company) => [company.id, company]));

  const companiesByDomain = new Map<string, Company[]>();
  for (const company of release.companies.filter((item) => !item.archived)) {
    const domain = normalizeDomain(company.domain);
    if (!domain) continue;
    const group = companiesByDomain.get(domain) ?? [];
    group.push(company);
    companiesByDomain.set(domain, group);
  }

  for (const [domain, companies] of companiesByDomain) {
    if (companies.length < 2) continue;
    findings.push(
      finding(
        release,
        "CRM-COMPANY-001",
        "critical",
        "company",
        companies.map((company) => company.id),
        { normalizedDomain: domain, companyNames: companies.map((company) => company.name).sort() },
        "Review the candidate group and resolve identity manually.",
        "manual-only",
      ),
    );
  }

  for (const company of release.companies.filter((item) => !item.archived && item.targetCandidate)) {
    if (!normalizeDomain(company.domain)) {
      findings.push(
        finding(
          release,
          "CRM-COMPANY-002",
          "critical",
          "company",
          [company.id],
          { domain: company.domain },
          "Research a trustworthy canonical domain and present it for approval.",
          "propose-only",
        ),
      );
    }

    if (company.customerStatus === "current") {
      findings.push(
        finding(
          release,
          "CRM-SUPPRESSION-001",
          "critical",
          "company",
          [company.id],
          { customerStatus: company.customerStatus, targetCandidate: company.targetCandidate },
          "Remove the company and its contacts from the application audience.",
          "reversible",
        ),
      );
    }

    const openDeals = release.deals.filter(
      (deal) => deal.companyId === company.id && isOpenNewBusinessDeal(deal),
    );
    if (openDeals.length > 0) {
      findings.push(
        finding(
          release,
          "CRM-SUPPRESSION-002",
          "critical",
          "company",
          [company.id],
          { openDealIds: openDeals.map((deal) => deal.id).sort() },
          "Block outbound activation while the new-business opportunity remains open.",
          "read-only",
        ),
      );
    }

    if (company.serviceableGeography === null) {
      findings.push(
        finding(
          release,
          "CRM-DATA-002",
          "critical",
          "company",
          [company.id],
          { state: company.state, serviceableGeography: company.serviceableGeography },
          "Enrich geography and confirm that the account is inside the service area.",
          "propose-only",
        ),
      );
    }

    if (company.locationCount === null) {
      findings.push(
        finding(
          release,
          "CRM-DATA-003",
          "warning",
          "company",
          [company.id],
          { locationCount: company.locationCount },
          "Enrich the location-count band with provenance.",
          "propose-only",
        ),
      );
    }
  }

  const contactsByEmail = new Map<string, Contact[]>();
  for (const contact of release.contacts) {
    const email = normalizeEmail(contact.email);
    if (!email) continue;
    const group = contactsByEmail.get(email) ?? [];
    group.push(contact);
    contactsByEmail.set(email, group);
  }

  for (const [email, contacts] of contactsByEmail) {
    if (contacts.length < 2) continue;
    findings.push(
      finding(
        release,
        "CRM-CONTACT-002",
        "critical",
        "contact",
        contacts.map((contact) => contact.id),
        { normalizedEmail: email },
        "Suppress the duplicate group and resolve identity manually.",
        "manual-only",
      ),
    );
  }

  for (const contact of release.contacts) {
    const company = contact.companyId ? companiesById.get(contact.companyId) : undefined;

    if (!company) {
      findings.push(
        finding(
          release,
          "CRM-CONTACT-001",
          "critical",
          "contact",
          [contact.id],
          { companyId: contact.companyId },
          "Associate the contact only when one canonical company is supported by evidence.",
          "propose-only",
        ),
      );
    }

    if (contact.lifecycleStage === "customer" && company && company.customerStatus !== "current") {
      const hasClosedWonDeal = release.deals.some(
        (deal) => deal.companyId === company.id && !deal.archived && deal.stage === "closed_won",
      );
      if (!hasClosedWonDeal) {
        findings.push(
          finding(
            release,
            "CRM-LIFECYCLE-001",
            "warning",
            "contact",
            [contact.id],
            {
              contactLifecycleStage: contact.lifecycleStage,
              companyCustomerStatus: company.customerStatus,
              closedWonDealFound: false,
            },
            "Review the conflicting lifecycle evidence; do not change lifecycle automatically.",
            "manual-only",
          ),
        );
      }
    }

    if (!contact.targetCandidate) continue;

    if (!contact.ownerId) {
      findings.push(
        finding(
          release,
          "CRM-OWNER-002",
          "critical",
          "contact",
          [contact.id],
          { ownerId: contact.ownerId },
          "Assign an accountable owner through an approved ownership rule.",
          "propose-only",
        ),
      );
    }

    if (contact.emailUnsubscribed) {
      findings.push(
        finding(
          release,
          "CRM-SUPPRESSION-003",
          "critical",
          "contact",
          [contact.id],
          { emailUnsubscribed: true },
          "Preserve suppression and prohibit Lemlist activation.",
          "read-only",
        ),
      );
    }

    if (contact.doNotCall) {
      findings.push(
        finding(
          release,
          "CRM-SUPPRESSION-004",
          "critical",
          "contact",
          [contact.id],
          { doNotCall: true },
          "Preserve suppression and prohibit TitanX activation.",
          "read-only",
        ),
      );
    }

    if (!contact.persona) {
      findings.push(
        finding(
          release,
          "CRM-DATA-001",
          "critical",
          "contact",
          [contact.id],
          { title: contact.title, persona: contact.persona },
          "Map the title to an approved persona or route it for review.",
          "propose-only",
        ),
      );
    }

    const referenceAt = contactReferenceAt(release, contact);
    const staleBoundary = Date.parse(release.config.asOf) - release.config.staleContactDays * DAY_MS;
    if (!referenceAt || Date.parse(referenceAt) < staleBoundary) {
      findings.push(
        finding(
          release,
          "CRM-DATA-004",
          "warning",
          "contact",
          [contact.id],
          { latestActivityOrEnrichmentAt: referenceAt, staleBoundary: new Date(staleBoundary).toISOString() },
          "Refresh the contact through verified enrichment before asserting channel readiness.",
          "propose-only",
        ),
      );
    }

    if (contact.emailStatus !== "verified") {
      findings.push(
        finding(
          release,
          "CRM-DATA-005",
          "critical",
          "contact",
          [contact.id],
          { email: contact.email, emailStatus: contact.emailStatus },
          "Keep email activation blocked until a verified email is available.",
          "read-only",
        ),
      );
    }

    if (contact.phoneStatus !== "verified" || !contact.phone) {
      findings.push(
        finding(
          release,
          "CRM-DATA-006",
          "critical",
          "contact",
          [contact.id],
          { phone: contact.phone, phoneStatus: contact.phoneStatus },
          "Keep phone activation blocked until a usable verified number is available.",
          "read-only",
        ),
      );
    }
  }

  for (const activity of release.activities) {
    if (activity.requiresDisposition === true && !activity.outcome?.trim()) {
      findings.push(
        finding(
          release,
          "CRM-ACTIVITY-001",
          "warning",
          "activity",
          [activity.id],
          { activityType: activity.type, outcome: activity.outcome ?? null },
          "Request a mapped human or connector-supplied disposition.",
          "manual-only",
        ),
      );
    }
  }

  for (const deal of release.deals.filter(isOpenNewBusinessDeal)) {
    if (!deal.companyId || !companiesById.has(deal.companyId)) {
      findings.push(
        finding(
          release,
          "CRM-DEAL-001",
          "critical",
          "deal",
          [deal.id],
          { companyId: deal.companyId },
          "Associate the deal to a canonical company through manual review.",
          "manual-only",
        ),
      );
    }

    if (!deal.ownerId) {
      findings.push(
        finding(
          release,
          "CRM-OWNER-001",
          "critical",
          "deal",
          [deal.id],
          { ownerId: deal.ownerId },
          "Assign an accountable deal owner through an approved rule.",
          "propose-only",
        ),
      );
    }

    const latestAt = latestMaterialActivityAt(release, { dealId: deal.id });
    const staleBoundary = Date.parse(release.config.asOf) - release.config.staleDealDays * DAY_MS;
    const futureTask = hasFutureOwnedTask(release, deal.id);
    if ((!latestAt || Date.parse(latestAt) < staleBoundary) && !futureTask) {
      findings.push(
        finding(
          release,
          "CRM-DEAL-002",
          "warning",
          "deal",
          [deal.id],
          { latestMaterialActivityAt: latestAt, staleBoundary: new Date(staleBoundary).toISOString(), futureOwnedTask: futureTask },
          "Create a rep review task; do not change the deal stage automatically.",
          "propose-only",
        ),
      );
    }

    if (!deal.nextStep?.trim() && !futureTask) {
      findings.push(
        finding(
          release,
          "CRM-DEAL-003",
          "warning",
          "deal",
          [deal.id],
          { nextStep: deal.nextStep, futureOwnedTask: futureTask },
          "Request a human-authored next step or an owner-assigned future task.",
          "manual-only",
        ),
      );
    }
  }

  return findings.sort((left, right) => left.findingId.localeCompare(right.findingId));
}

