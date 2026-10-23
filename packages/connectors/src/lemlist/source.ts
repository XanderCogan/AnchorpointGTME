import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAttioPeopleAndCompanies } from "../../../db/src/attio-mirror.ts";
import { candidatesFromAttio, parseApprovals } from "./attio-source.ts";
import type { EnrollmentCandidate } from "./enrollment.ts";
import { loadPracticeContacts } from "./practice.ts";

// The one enrollment input both lemlist:draft and lemlist:enroll read, so a draft is
// always keyed the way the enrollment plan will look it up.
export async function loadEnrollmentSource(args: { source: string; approvals?: string; practicePath: string }): Promise<{
  candidates: EnrollmentCandidate[];
  localDoNotContact: string[];
}> {
  if (args.source === "practice") return loadPracticeContacts(args.practicePath);
  if (args.source === "attio") {
    const connectionId = process.env.ATTIO_CONNECTION_ID;
    if (!connectionId) throw new Error("Set ATTIO_CONNECTION_ID to read the Attio mirror.");
    if (!args.approvals) throw new Error("--source attio needs --approvals <file.json> until Milestone 5's approval table exists.");
    const approvals = parseApprovals(JSON.parse(readFileSync(resolve(args.approvals), "utf8")));
    const source = candidatesFromAttio({ ...(await loadAttioPeopleAndCompanies(connectionId)), approvals });
    if (source.unlinked.length > 0) console.log(`${source.unlinked.length} people skipped: not linked to a mirrored company.`);
    return source;
  }
  throw new Error(`Unknown --source ${args.source}; use practice or attio.`);
}
