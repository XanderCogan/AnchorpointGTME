import type { Finding, FixtureRelease } from "./types.ts";

export interface FindingView extends Finding {
  title: string;
  recordNames: string[];
  ownerName: string;
}

const ruleLabels: Record<string, string> = {
  "CRM-ACTIVITY-001": "Follow-up missing a disposition",
  "CRM-COMPANY-001": "Duplicate company identity",
  "CRM-COMPANY-002": "Company missing a trusted domain",
  "CRM-CONTACT-001": "Contact missing its company",
  "CRM-CONTACT-002": "Duplicate contact identity",
  "CRM-DATA-001": "Contact missing an approved persona",
  "CRM-DATA-002": "Serviceability is unresolved",
  "CRM-DATA-003": "Location footprint is incomplete",
  "CRM-DATA-004": "Contact data is stale",
  "CRM-DATA-005": "Email is not verified",
  "CRM-DATA-006": "Phone is not usable",
  "CRM-DEAL-001": "Deal missing its company",
  "CRM-DEAL-002": "Open deal has gone stale",
  "CRM-DEAL-003": "Open deal has no next step",
  "CRM-LIFECYCLE-001": "Lifecycle evidence conflicts",
  "CRM-OWNER-001": "Deal has no accountable owner",
  "CRM-OWNER-002": "Contact has no accountable owner",
  "CRM-SUPPRESSION-001": "Current customer in prospecting",
  "CRM-SUPPRESSION-002": "Open opportunity in prospecting",
  "CRM-SUPPRESSION-003": "Email suppression conflict",
  "CRM-SUPPRESSION-004": "Do-not-call conflict",
};

export function buildFindingViews(release: FixtureRelease, findings: Finding[]): FindingView[] {
  const owners = new Map(release.owners.map((owner) => [owner.id, owner.name]));
  const companies = new Map(release.companies.map((company) => [company.id, company]));
  const contacts = new Map(release.contacts.map((contact) => [contact.id, contact]));
  const deals = new Map(release.deals.map((deal) => [deal.id, deal]));
  const activities = new Map(release.activities.map((activity) => [activity.id, activity]));

  function recordName(objectType: Finding["objectType"], id: string): string {
    if (objectType === "company") return companies.get(id)?.name ?? id;
    if (objectType === "contact") {
      const contact = contacts.get(id);
      return contact ? `${contact.firstName} ${contact.lastName}` : id;
    }
    if (objectType === "deal") return deals.get(id)?.name ?? id;
    if (objectType === "activity") {
      const activity = activities.get(id);
      return activity ? `${activity.type.replaceAll("_", " ")} · ${id}` : id;
    }
    return id;
  }

  function ownerName(objectType: Finding["objectType"], ids: string[]): string {
    const firstId = ids[0];
    if (!firstId) return "Review queue";
    let ownerId: string | null | undefined;
    if (objectType === "company") ownerId = companies.get(firstId)?.ownerId;
    if (objectType === "contact") ownerId = contacts.get(firstId)?.ownerId;
    if (objectType === "deal") ownerId = deals.get(firstId)?.ownerId;
    return ownerId ? owners.get(ownerId) ?? "Unknown owner" : "Unassigned";
  }

  return findings.map((finding) => ({
    ...finding,
    title: ruleLabels[finding.ruleId] ?? finding.ruleId,
    recordNames: finding.affectedIds.map((id) => recordName(finding.objectType, id)),
    ownerName: ownerName(finding.objectType, finding.affectedIds),
  }));
}
