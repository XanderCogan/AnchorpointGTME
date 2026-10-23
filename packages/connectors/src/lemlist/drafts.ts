import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { draftVariables, isReviewed, requiresReview, type DraftFile } from "../../../core/src/draft-copy.ts";
import type { EnrollmentDecision } from "./enrollment.ts";

// Carries a signal-based draft into a Lemlist lead as custom variables. For a band A
// operator (decision 0017) a draft no human has marked reviewed turns the enrollment
// into a skip; other drafts carry on the campaign approval alone. A contact with no
// draft file enrolls as before, without copy variables. This runs after the
// deny-first plan and never loosens any of its decisions.

export const DEFAULT_DRAFTS_DIR = join("data", "georgia-sample", "private", "drafts");

export const draftPathFor = (dir: string, contactKey: string): string => join(dir, `${contactKey.replace(/[^A-Za-z0-9_.-]/g, "_")}.json`);

export function readDraftFile(dir: string, contactKey: string): DraftFile | null {
  const path = draftPathFor(dir, contactKey);
  if (!existsSync(path)) return null;
  const file = JSON.parse(readFileSync(path, "utf8")) as DraftFile;
  if (file.contactKey !== contactKey) throw new Error(`Draft file ${path} is for ${file.contactKey}, not ${contactKey}.`);
  return file;
}

export function attachDrafts(decisions: EnrollmentDecision[], lookup: (contactKey: string) => DraftFile | null): EnrollmentDecision[] {
  return decisions.map((decision) => {
    if (decision.action !== "enroll") return decision;
    const draft = lookup(decision.contactKey);
    if (!draft) return decision;
    if (requiresReview(draft) && !isReviewed(draft)) return { contactKey: decision.contactKey, action: "skip", reason: "draft_not_reviewed" };
    return { ...decision, lead: { ...decision.lead, variables: { ...decision.lead.variables, ...draftVariables(draft) } } };
  });
}
