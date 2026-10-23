import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fact sheet for signal-based outreach drafts. Everything here is read from the
// committed Georgia sample (tiers.json, signals.json, facility-operator-links.json,
// serviceability.json, web-signals.json) and every fact carries the source string the
// sample recorded for it. A fact with no source is dropped, never guessed. The only
// person-level fields are the contact's first name, title, and persona.

export interface SourcedFact {
  source: string;
}

export interface ComponentFact extends SourcedFact {
  name: string;
  points: number;
  max: number;
  input: string;
}

export interface CitationFact extends SourcedFact {
  tag: string;
  cmsDescription: string;
  line: string;
  surveyDate: string;
  corrected: boolean;
  // True when the facility was cited for this service line on more than one survey.
  repeated: boolean;
}

export interface FacilityFacts {
  ccn: string;
  name: string;
  city: string | null;
  driveMinutes: number | null;
  nearestBranch: string | null;
  citations: CitationFact[];
}

export interface OwnershipFact extends SourcedFact {
  facilitiesWithOwnershipChange: number;
  facilitiesWithManagementChange: number;
  latestOwnershipAssociation: string | null;
}

export interface HiringFact extends SourcedFact {
  title: string;
  url: string;
  date: string | null;
}

export interface DraftFactSheet {
  operator: { operatorId: string; name: string; band: string; score: number; footprintFacilities: number; explanation: string; source: string };
  contact: { firstName?: string; jobTitle?: string; persona: string };
  components: ComponentFact[];
  facilities: FacilityFacts[];
  ownership: OwnershipFact | null;
  hiring: HiringFact[];
  retrieved: { cms: string; web: string | null };
}

export interface DraftData {
  tiers: any;
  signals: any;
  links: any;
  serviceability: any;
  webSignals: any;
}

const read = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

export function loadDraftData(dir: string): DraftData {
  return {
    tiers: read(dir, "tiers.json"),
    signals: read(dir, "signals.json"),
    links: read(dir, "facility-operator-links.json"),
    serviceability: read(dir, "serviceability.json"),
    webSignals: read(dir, "web-signals.json"),
  };
}

const hasSource = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && !/^none( yet)?$/i.test(value.trim()) && !/^not yet collected$/i.test(value.trim());

const sourceLine = (sources: any[] | undefined, datasetId: string): string => {
  const entry = sources?.find((s) => s.datasetId === datasetId);
  return entry ? `CMS dataset ${datasetId} (modified ${entry.cmsModified}, retrieved ${entry.retrievedOn})` : `CMS dataset ${datasetId}`;
};

export function buildFactSheet(
  input: { operatorId: string; persona: string; firstName?: string; jobTitle?: string; maxComponents?: number },
  data: DraftData,
): DraftFactSheet {
  const tier = [...data.tiers.operators, ...(data.tiers.outsideFootprint ?? [])].find((o: any) => o.operatorId === input.operatorId);
  if (!tier) throw new Error(`Operator ${input.operatorId} is not in tiers.json.`);
  const method = data.tiers.method ?? {};
  const tierSource = `tiers.json (${method.contract ?? "account score"}, parameters ${method.parametersVersion ?? "unknown"}, as of ${method.asOf ?? "unknown"})`;

  // Strongest earned components: points above zero, a recorded source, and no proposal flag.
  const maxComponents = Math.min(Math.max(input.maxComponents ?? 5, 3), 5);
  const components: ComponentFact[] = Object.entries(tier.components ?? {})
    .map(([name, c]: [string, any]) => ({ name, points: Number(c.points), max: Number(c.max), input: String(c.input ?? ""), source: String(c.source ?? "") }))
    .filter((c) => c.points > 0 && hasSource(c.source) && c.input !== "")
    .sort((a, b) => b.points - a.points || b.points / b.max - a.points / a.max)
    .slice(0, maxComponents);

  // In-footprint sites are the tiers.json value sites the footprint counted, never the whole chain.
  const footprint = new Set<string>((tier.value?.sites ?? []).filter((s: any) => s.anchorState !== "not_serviceable").map((s: any) => String(s.ccn)));
  const tagMap = new Map<string, any>((data.signals.method?.tagMap ?? []).map((t: any) => [t.tag, t]));
  const citationSource = `${sourceLine(data.signals.method?.sources, "ifjz-ge4w")} via signals.json`;
  const linkByCcn = new Map<string, any>((data.links.links ?? []).map((l: any) => [String(l.ccn), l]));
  const serviceByCcn = new Map<string, any>((data.serviceability.facilities ?? []).map((f: any) => [String(f.ccn), f]));

  const facilities: FacilityFacts[] = [];
  for (const facility of data.signals.facilities ?? []) {
    if (facility.operatorId !== input.operatorId || !footprint.has(String(facility.ccn))) continue;
    const citations: CitationFact[] = [];
    for (const [line, detail] of Object.entries<any>(facility.lines ?? {})) {
      for (const evidence of detail.evidence ?? []) {
        const tag = tagMap.get(evidence.tag);
        if (!tag || !evidence.surveyDate) continue;
        citations.push({
          tag: evidence.tag,
          cmsDescription: String(tag.cmsDescription),
          line,
          surveyDate: String(evidence.surveyDate),
          corrected: evidence.corrected === true,
          repeated: detail.repeated === true,
          source: citationSource,
        });
      }
    }
    if (citations.length === 0) continue;
    citations.sort((a, b) => b.surveyDate.localeCompare(a.surveyDate));
    const link = linkByCcn.get(String(facility.ccn));
    const service = serviceByCcn.get(String(facility.ccn));
    facilities.push({
      ccn: String(facility.ccn),
      name: String(service?.facilityName ?? link?.facilityName ?? facility.ccn),
      city: service?.city ?? link?.city ?? null,
      driveMinutes: typeof service?.nearestBranchDriveMinutes === "number" ? service.nearestBranchDriveMinutes : null,
      nearestBranch: service?.nearestBranch ?? null,
      citations,
    });
  }
  // Strongest first: repeated sprinkler or alarm citations, then citation count, then recency.
  const weight = (f: FacilityFacts) => f.citations.filter((c) => c.repeated && (c.line === "sprinkler_itm" || c.line === "fire_alarm_itm")).length;
  facilities.sort((a, b) => weight(b) - weight(a) || b.citations.length - a.citations.length || (b.citations[0]?.surveyDate ?? "").localeCompare(a.citations[0]?.surveyDate ?? ""));

  const operatorSignals = (data.signals.operators ?? []).find((o: any) => o.operatorId === input.operatorId);
  const ownership: OwnershipFact | null = operatorSignals
    ? {
        facilitiesWithOwnershipChange: Number(operatorSignals.facilitiesWithOwnershipChange ?? 0),
        facilitiesWithManagementChange: Number(operatorSignals.facilitiesWithManagementChange ?? 0),
        latestOwnershipAssociation: operatorSignals.latestOwnershipAssociation ?? null,
        source: `${sourceLine(data.signals.method?.sources, "y2hd-n93e")} and ${sourceLine(data.signals.method?.sources, "4pq5-n9py")} via signals.json`,
      }
    : null;

  const webRetrieved: string | null = data.webSignals.method?.retrievedOn ?? null;
  const hiring: HiringFact[] = [];
  for (const job of (data.webSignals.jobs ?? []).filter((j: any) => j.operatorId === input.operatorId)) {
    for (const posting of job.postings ?? []) {
      if (!posting.url || !posting.title) continue;
      hiring.push({ title: String(posting.title), url: String(posting.url), date: posting.date ?? null, source: `web-signals.json jobs (Serper, ${webRetrieved ?? "undated"}); posting candidate, not confirmed open` });
    }
  }

  return {
    operator: {
      operatorId: tier.operatorId,
      name: String(tier.name),
      band: String(tier.band),
      score: Number(tier.score),
      footprintFacilities: Number(tier.footprintFacilities ?? footprint.size),
      explanation: String(tier.explanation ?? ""),
      source: tierSource,
    },
    contact: { firstName: input.firstName, jobTitle: input.jobTitle, persona: input.persona },
    components,
    facilities,
    ownership,
    hiring,
    retrieved: { cms: data.signals.method?.sources?.[0]?.retrievedOn ?? "unknown", web: webRetrieved },
  };
}

// Every fact the sheet holds, for checks that each one carries a source.
export function collectFacts(sheet: DraftFactSheet): SourcedFact[] {
  return [sheet.operator, ...sheet.components, ...sheet.facilities.flatMap((f) => f.citations), ...(sheet.ownership ? [sheet.ownership] : []), ...sheet.hiring];
}

// Plain-text rendering handed to the model. Dates stay ISO so the validator can
// match the cited record back to the sheet.
export function renderFactSheet(sheet: DraftFactSheet): string {
  const lines: string[] = [];
  lines.push(`Operator: ${sheet.operator.name} (band ${sheet.operator.band}, score ${sheet.operator.score}, ${sheet.operator.footprintFacilities} Georgia nursing homes in Anchorpoint's footprint). Source: ${sheet.operator.source}.`);
  lines.push(`Why it ranks here: ${sheet.operator.explanation}`);
  lines.push(`Contact: ${sheet.contact.firstName ?? "(first name unknown)"}, ${sheet.contact.jobTitle ?? "(title unknown)"}, persona ${sheet.contact.persona}.`);
  lines.push("", "Strongest scoring components:");
  for (const c of sheet.components) lines.push(`- ${c.name}: ${c.input} (${c.points} of ${c.max} points). Source: ${c.source}.`);
  if (sheet.ownership) {
    lines.push("", `Ownership: ${sheet.ownership.facilitiesWithOwnershipChange} facilities changed ownership and ${sheet.ownership.facilitiesWithManagementChange} changed management organization in the CMS window; latest ownership association ${sheet.ownership.latestOwnershipAssociation ?? "none recorded"}. Source: ${sheet.ownership.source}.`);
  }
  if (sheet.hiring.length > 0) {
    lines.push("", "Hiring (posting candidates, not confirmed open):");
    for (const h of sheet.hiring) lines.push(`- "${h.title}" at ${h.url}${h.date ? ` (${h.date})` : " (undated)"}. Source: ${h.source}.`);
  }
  lines.push("", `In-footprint facilities with Life Safety Code citations (${sheet.facilities.length}), strongest first. Source for every citation: ${sheet.facilities[0]?.citations[0]?.source ?? "signals.json"}.`);
  for (const f of sheet.facilities) {
    const where = [f.city, f.driveMinutes != null ? `${f.driveMinutes} minutes from the ${f.nearestBranch ?? ""} branch`.replace("the  branch", "nearest branch") : null].filter(Boolean).join(", ");
    lines.push(`- ${f.name} (CCN ${f.ccn}${where ? `; ${where}` : ""}):`);
    for (const c of f.citations) lines.push(`    ${c.tag} on ${c.surveyDate}: ${c.cmsDescription}${c.repeated ? " [cited on more than one survey]" : ""}${c.corrected ? " [correction date on record]" : ""}`);
  }
  return lines.join("\n");
}
