import type { LemlistClient, LeadInput } from "./client.ts";
import { LemlistGuardError } from "./transport.ts";

// Deny-first enrollment for one Lemlist campaign (Milestone 6, decision 0012). A plan
// decides every candidate before any write; execution claims an idempotency key in
// the ledger before calling Lemlist, so duplicate requests and retries cannot
// enroll a contact twice.

export interface EnrollmentCandidate {
  contactKey: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
  jobTitle?: string;
  // Scoring operator and role-map persona, when known; they select the draft fact sheet.
  operatorId?: string;
  persona?: string;
  // One approve step by a representative or manager inside the application.
  approval: { approvedBy: string; approvedAt: string } | null;
}

export type SkipReason =
  | "kill_switch"
  | "missing_email"
  | "suppressed_email"
  | "suppressed_domain"
  | "not_approved"
  | "already_enrolled"
  | "duplicate_in_request"
  // A draft file exists for the contact but no human has marked it reviewed.
  | "draft_not_reviewed";

export type EnrollmentDecision =
  | { contactKey: string; action: "enroll"; idempotencyKey: string; lead: LeadInput }
  | { contactKey: string; action: "skip"; reason: SkipReason };

export interface Suppressions {
  emails: ReadonlySet<string>;
  domains: ReadonlySet<string>;
}

export type LedgerStatus = "pending" | "enrolled" | "rejected" | "failed";

export interface LedgerEntry {
  idempotencyKey: string;
  campaignId: string;
  contactKey: string;
  email: string;
  status: LedgerStatus;
  leadId: string | null;
  detail: string | null;
}

export interface EnrollmentLedger {
  // Keys that block a new enrollment: pending, enrolled, or rejected. Failed keys may be retried.
  activeKeys(campaignId: string): Promise<Set<string>>;
  // Atomically claims the key; false when another request holds it.
  claim(entry: Omit<LedgerEntry, "status" | "leadId" | "detail">): Promise<boolean>;
  settle(idempotencyKey: string, status: Exclude<LedgerStatus, "pending">, leadId: string | null, detail: string | null): Promise<void>;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const idempotencyKeyFor = (campaignId: string, email: string): string => `${campaignId}:${normalizeEmail(email)}`;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planEnrollment(input: {
  campaignId: string;
  candidates: EnrollmentCandidate[];
  suppressions: Suppressions;
  activeKeys: ReadonlySet<string>;
  killSwitchEngaged: boolean;
}): EnrollmentDecision[] {
  const seen = new Set<string>();
  return input.candidates.map((candidate): EnrollmentDecision => {
    const skip = (reason: SkipReason): EnrollmentDecision => ({ contactKey: candidate.contactKey, action: "skip", reason });
    if (input.killSwitchEngaged) return skip("kill_switch");
    if (!candidate.email || !emailPattern.test(candidate.email.trim())) return skip("missing_email");
    const email = normalizeEmail(candidate.email);
    if (input.suppressions.emails.has(email)) return skip("suppressed_email");
    if (input.suppressions.domains.has(email.slice(email.lastIndexOf("@") + 1))) return skip("suppressed_domain");
    if (!candidate.approval) return skip("not_approved");
    const idempotencyKey = idempotencyKeyFor(input.campaignId, email);
    if (input.activeKeys.has(idempotencyKey)) return skip("already_enrolled");
    if (seen.has(idempotencyKey)) return skip("duplicate_in_request");
    seen.add(idempotencyKey);
    return {
      contactKey: candidate.contactKey,
      action: "enroll",
      idempotencyKey,
      lead: {
        email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        companyName: candidate.companyName,
        companyDomain: candidate.companyDomain,
        jobTitle: candidate.jobTitle,
        variables: { anchorpointContactKey: candidate.contactKey },
      },
    };
  });
}

// Lemlist's unsubscribe list holds both addresses and whole domains.
export function suppressionsFrom(values: Iterable<string>, localDoNotContact: Iterable<string> = []): Suppressions {
  const emails = new Set<string>();
  const domains = new Set<string>();
  for (const raw of [...values, ...localDoNotContact]) {
    const value = normalizeEmail(raw);
    if (!value) continue;
    if (value.includes("@")) emails.add(value);
    else domains.add(value.replace(/^@/, ""));
  }
  return { emails, domains };
}

export interface EnrollmentOutcome {
  contactKey: string;
  result: "enrolled" | "already_in_campaign" | "rejected_other_campaign" | "claimed_elsewhere" | "failed";
  leadId: string | null;
  detail: string | null;
}

export async function executeEnrollment(
  client: LemlistClient,
  ledger: EnrollmentLedger,
  campaignId: string,
  decisions: EnrollmentDecision[],
): Promise<EnrollmentOutcome[]> {
  const outcomes: EnrollmentOutcome[] = [];
  for (const decision of decisions) {
    if (decision.action !== "enroll") continue;
    const claimed = await ledger.claim({
      idempotencyKey: decision.idempotencyKey,
      campaignId,
      contactKey: decision.contactKey,
      email: decision.lead.email,
    });
    if (!claimed) {
      outcomes.push({ contactKey: decision.contactKey, result: "claimed_elsewhere", leadId: null, detail: null });
      continue;
    }
    try {
      const added = await client.addLead(campaignId, decision.lead);
      if (added.status === "in_other_campaign") {
        await ledger.settle(decision.idempotencyKey, "rejected", null, "lead already in another campaign");
        outcomes.push({ contactKey: decision.contactKey, result: "rejected_other_campaign", leadId: null, detail: null });
      } else {
        const leadId = added.status === "created" ? added.leadId : null;
        await ledger.settle(decision.idempotencyKey, "enrolled", leadId, added.status);
        outcomes.push({
          contactKey: decision.contactKey,
          result: added.status === "created" ? "enrolled" : "already_in_campaign",
          leadId,
          detail: null,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 500) : String(error);
      await ledger.settle(decision.idempotencyKey, "failed", null, detail);
      // A guard refusal, such as a sender attached to the campaign, stops the whole run.
      if (error instanceof LemlistGuardError) throw error;
      outcomes.push({ contactKey: decision.contactKey, result: "failed", leadId: null, detail });
    }
  }
  return outcomes;
}

export class InMemoryEnrollmentLedger implements EnrollmentLedger {
  readonly entries = new Map<string, LedgerEntry>();

  async activeKeys(campaignId: string): Promise<Set<string>> {
    return new Set(
      [...this.entries.values()].filter((entry) => entry.campaignId === campaignId && entry.status !== "failed").map((entry) => entry.idempotencyKey),
    );
  }

  async claim(entry: Omit<LedgerEntry, "status" | "leadId" | "detail">): Promise<boolean> {
    const existing = this.entries.get(entry.idempotencyKey);
    if (existing && existing.status !== "failed") return false;
    this.entries.set(entry.idempotencyKey, { ...entry, status: "pending", leadId: null, detail: null });
    return true;
  }

  async settle(idempotencyKey: string, status: Exclude<LedgerStatus, "pending">, leadId: string | null, detail: string | null): Promise<void> {
    const entry = this.entries.get(idempotencyKey);
    if (!entry) throw new Error(`No ledger entry for ${idempotencyKey}.`);
    this.entries.set(idempotencyKey, { ...entry, status, leadId, detail });
  }
}
