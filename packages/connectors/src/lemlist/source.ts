import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAttioPeopleAndCompanies } from "../../../db/src/attio-mirror.ts";
import { attioConfigFromEnv } from "../attio/config.ts";
import { connectAttio } from "../attio/connect.ts";
import { approvalsFromListEntries, candidatesFromAttio, parseApprovals, type Approval } from "./attio-source.ts";
import type { EnrollmentCandidate } from "./enrollment.ts";
import { loadPracticeContacts } from "./practice.ts";

// The one enrollment input both lemlist:draft and lemlist:enroll read, so a draft is
// always keyed the way the enrollment plan will look it up.
// Decision 0015: approval is membership of the approved campaign's audience List. An
// --approvals file is the offline alternative.
async function loadApprovals(args: { approvals?: string; approvedList?: string }): Promise<ReadonlyMap<string, Approval>> {
  const listSlug = args.approvedList ?? process.env.ATTIO_APPROVED_LIST;
  if (listSlug) {
    const attioConfig = attioConfigFromEnv();
    if (!attioConfig) throw new Error("Set ATTIO_ACCESS_TOKEN to read the approved List.");
    const entries = [];
    for await (const page of connectAttio(attioConfig).queryListEntries(listSlug, { pageSize: 500, maxPages: 20 })) entries.push(...page);
    const approvals = approvalsFromListEntries(entries, listSlug);
    console.log(`${approvals.size} people approved by membership of Attio List ${listSlug}.`);
    return approvals;
  }
  if (args.approvals) return parseApprovals(JSON.parse(readFileSync(resolve(args.approvals), "utf8")));
  throw new Error("--source attio needs --approved-list <slug> (or ATTIO_APPROVED_LIST), or --approvals <file.json> for an offline run.");
}

export async function loadEnrollmentSource(args: { source: string; approvals?: string; approvedList?: string; practicePath: string }): Promise<{
  candidates: EnrollmentCandidate[];
  localDoNotContact: string[];
}> {
  if (args.source === "practice") {
    const practice = loadPracticeContacts(args.practicePath);
    if (!args.approvals) return practice;
    // Decision 0017: an approvals file overlays the fixture, which stays unchanged.
    const approvals = parseApprovals(JSON.parse(readFileSync(resolve(args.approvals), "utf8")));
    return {
      ...practice,
      candidates: practice.candidates.map((c) => (approvals.has(c.contactKey) ? { ...c, approval: approvals.get(c.contactKey)! } : c)),
    };
  }
  if (args.source === "attio") {
    const connectionId = process.env.ATTIO_CONNECTION_ID;
    if (!connectionId) throw new Error("Set ATTIO_CONNECTION_ID to read the Attio mirror.");
    const approvals = await loadApprovals(args);
    const source = candidatesFromAttio({ ...(await loadAttioPeopleAndCompanies(connectionId)), approvals });
    if (source.unlinked.length > 0) console.log(`${source.unlinked.length} people skipped: not linked to a mirrored company.`);
    return source;
  }
  throw new Error(`Unknown --source ${args.source}; use practice or attio.`);
}
