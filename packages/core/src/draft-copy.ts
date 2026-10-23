import { z } from "zod";
import type { DraftFactSheet } from "./draft-inputs.ts";

// The drafting contract: what the model is asked for, how its answer is checked, and
// the review gate a human must pass before a draft can travel as Lemlist variables.
// No draft is ever sent; the gate exists so unread copy cannot reach a campaign.

export const MAX_WORDS = 120;

export const draftCopySchema = z.object({
  subject: z.string().min(1),
  icebreaker: z.string().min(1),
  hook_fact: z.string().min(1),
  body: z.string().min(1),
});
export type DraftCopy = z.infer<typeof draftCopySchema>;

export interface DraftFile {
  contactKey: string;
  operatorId: string;
  persona: string;
  generatedOn: string;
  model: string;
  factSheet: DraftFactSheet;
  draft: DraftCopy;
  // A human fills both after reading the draft. Enrollment refuses the file without them.
  reviewedBy: string | null;
  reviewedOn: string | null;
}

export const SYSTEM_PROMPT = `You draft one short cold email for Anchorpoint Fire & Safety, a fire and life-safety inspection and maintenance company in Georgia, to a named contact at a nursing-home operator. You are given a fact sheet built only from public records. Write from the fact sheet and nothing else.

Rules, all of them hard:
- Under ${MAX_WORDS} words across the icebreaker and body together. Fewer is better.
- Exactly one hook: name one public record (a CMS Life Safety Code citation tag at one named facility) and the date of the survey that recorded it, written in plain language. Use the facility name and the tag code as the sheet gives them.
- Plain language a busy operations leader reads in ten seconds. No jargon beyond the tag code and the words sprinkler, fire alarm, extinguisher, kitchen hood, emergency lighting, fire door, or firestopping.
- Make no claim about the person: nothing about their tenure, start date, background, workload, priorities, or feelings. Address them by first name only if one is given.
- No pricing, discounts, or money. No urgency language (nothing like urgent, immediately, act now, limited, deadline, before it is too late). No competitors, vendors, or incumbents named or implied. No severity letters, bed counts, account values, or facilities outside the sheet.
- Do not say earlier fixes failed; a correction date records a commitment. Do not mention ownership or management changes, hiring, or how the operator was scored.
- Write the sender as "[Rep name]" at a named Anchorpoint branch if the sheet gives one, else "[Rep name], Anchorpoint Fire & Safety". No em dashes.
- The subject is one line under ten words and does not use the word deficiency.

Return JSON with exactly these keys: subject (one line), icebreaker (the opening two sentences, including the hook), hook_fact (one sentence naming the single record cited: facility, tag code, and survey date in YYYY-MM-DD form), body (the rest of the email after the icebreaker, ending with the sign-off).`;

export const URGENCY_WORDS = ["urgent", "urgently", "immediately", "act now", "right away", "limited time", "deadline", "asap", "before it's too late", "before it is too late", "last chance", "don't wait", "do not wait", "hurry"];
export const PRICING_WORDS = ["$", "price", "pricing", "discount", "cost", "quote", "fee", "per month", "per year"];

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export interface DraftValidation {
  ok: boolean;
  problems: string[];
  words: number;
}

// Checks a model answer against the rules the prompt states and against the sheet it
// was drafted from. Problems are reported together so a reviewer sees all of them.
export function validateDraft(raw: unknown, sheet: DraftFactSheet): DraftValidation {
  const parsed = draftCopySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: [`missing or empty field: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`], words: 0 };
  const draft = parsed.data;
  const problems: string[] = [];
  const email = `${draft.icebreaker} ${draft.body}`;
  const words = wordCount(email);
  if (words >= MAX_WORDS) problems.push(`${words} words; must be under ${MAX_WORDS}`);
  if (/[\r\n]/.test(draft.subject.trim())) problems.push("subject is not one line");
  if (wordCount(draft.subject) >= 10) problems.push("subject is ten words or more");
  if (/deficienc/i.test(draft.subject)) problems.push("subject uses the word deficiency");
  const all = `${draft.subject} ${email}`;
  const lower = all.toLowerCase();
  if (all.includes("—")) problems.push("contains an em dash");
  for (const word of URGENCY_WORDS) if (lower.includes(word)) problems.push(`urgency language: "${word}"`);
  for (const word of PRICING_WORDS) if (word === "$" ? all.includes("$") : new RegExp(`\\b${word}\\b`).test(lower)) problems.push(`pricing language: "${word}"`);

  const dates = new Set(sheet.facilities.flatMap((f) => f.citations.map((c) => c.surveyDate)));
  const tags = new Set(sheet.facilities.flatMap((f) => f.citations.map((c) => c.tag.replace(/^K-0*/, ""))));
  const hookDate = draft.hook_fact.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!hookDate) problems.push("hook_fact has no YYYY-MM-DD survey date");
  else if (!dates.has(hookDate)) problems.push(`hook_fact date ${hookDate} is not a survey date on the fact sheet`);
  const hookTag = draft.hook_fact.match(/K-?0*(\d{3})/i)?.[1];
  if (!hookTag) problems.push("hook_fact names no K tag");
  else if (!tags.has(hookTag)) problems.push(`hook_fact tag K-${hookTag} is not on the fact sheet`);
  const facilityNamed = sheet.facilities.some((f) => draft.hook_fact.toLowerCase().includes(f.name.toLowerCase()) || draft.hook_fact.includes(f.ccn));
  if (!facilityNamed) problems.push("hook_fact names no facility from the fact sheet");

  return { ok: problems.length === 0, problems, words };
}

export class DraftNotReviewedError extends Error {
  constructor(contactKey: string) {
    super(`Draft for ${contactKey} has no reviewedBy and reviewedOn; a human must read it and mark the file before enrollment.`);
    this.name = "DraftNotReviewedError";
  }
}

const filled = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

export function isReviewed(file: Pick<DraftFile, "reviewedBy" | "reviewedOn">): boolean {
  return filled(file.reviewedBy) && filled(file.reviewedOn);
}

export function assertReviewed(file: Pick<DraftFile, "contactKey" | "reviewedBy" | "reviewedOn">): void {
  if (!isReviewed(file)) throw new DraftNotReviewedError(file.contactKey);
}

// Decision 0017: a person reads each draft only for band A operators. Other drafts
// travel on the campaign approval alone, inside the validator's limits.
export const REVIEWED_BANDS: ReadonlySet<string> = new Set(["A"]);

export function requiresReview(file: Pick<DraftFile, "factSheet">): boolean {
  return REVIEWED_BANDS.has(String(file.factSheet?.operator?.band ?? ""));
}

export function assertReviewedIfRequired(file: Pick<DraftFile, "contactKey" | "factSheet" | "reviewedBy" | "reviewedOn">): void {
  if (requiresReview(file)) assertReviewed(file);
}

// The Lemlist custom variables a draft contributes to its lead. The review variables
// are present only when a person filled them.
export function draftVariables(file: DraftFile): Record<string, string> {
  assertReviewedIfRequired(file);
  const variables: Record<string, string> = {
    subject: file.draft.subject,
    icebreaker: file.draft.icebreaker,
    hook_fact: file.draft.hook_fact,
    body: file.draft.body,
  };
  if (isReviewed(file)) {
    variables.draftReviewedBy = file.reviewedBy as string;
    variables.draftReviewedOn = file.reviewedOn as string;
  }
  return variables;
}
