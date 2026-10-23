import { readFileSync } from "node:fs";
import { z } from "zod";
import type { EnrollmentCandidate } from "./enrollment.ts";

const practiceSchema = z.object({
  synthetic: z.literal(true),
  localDoNotContact: z.array(z.string()),
  candidates: z.array(
    z.object({
      contactKey: z.string().min(1),
      email: z.string().nullable(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      companyName: z.string().optional(),
      jobTitle: z.string().optional(),
      operatorId: z.string().optional(),
      persona: z.string().optional(),
      approval: z.object({ approvedBy: z.string(), approvedAt: z.string() }).nullable(),
    }),
  ),
});

// Practice contacts stand in for the approval table until real Attio and Clay data
// reaches it (decision 0012).
export function loadPracticeContacts(path: string): { candidates: EnrollmentCandidate[]; localDoNotContact: string[] } {
  return practiceSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
