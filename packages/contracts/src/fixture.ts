import { z } from "zod";

const nullableString = z.string().nullable();

const ownerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean(),
});

const companySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: nullableString,
  archived: z.boolean(),
  customerStatus: z.enum(["current", "former", "prospect", "unknown"]),
  serviceableGeography: z.boolean().nullable(),
  state: nullableString,
  industrySegment: nullableString,
  locationCount: z.number().int().nonnegative().nullable(),
  ownerId: nullableString,
  targetCandidate: z.boolean(),
  lastModifiedAt: z.iso.datetime({ offset: true }),
});

const contactSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  companyId: nullableString,
  title: nullableString,
  persona: nullableString,
  ownerId: nullableString,
  email: nullableString,
  emailStatus: z.enum(["verified", "invalid", "unverified", "missing"]),
  emailUnsubscribed: z.boolean(),
  phone: nullableString,
  phoneStatus: z.enum(["verified", "unverified", "missing"]),
  doNotCall: z.boolean(),
  targetCandidate: z.boolean(),
  lifecycleStage: z
    .enum([
      "subscriber",
      "lead",
      "marketing_qualified_lead",
      "sales_qualified_lead",
      "opportunity",
      "customer",
    ])
    .optional(),
  lastEnrichmentVerifiedAt: nullableString,
  lastModifiedAt: z.iso.datetime({ offset: true }),
});

const dealSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  companyId: nullableString,
  ownerId: nullableString,
  pipeline: z.enum(["new_business", "implementation", "renewal", "support"]),
  stage: z.enum(["qualification", "evaluation", "proposal", "closed_won", "closed_lost"]),
  nextStep: nullableString,
  archived: z.boolean(),
  lastModifiedAt: z.iso.datetime({ offset: true }),
});

const activitySchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "call",
    "sales_email",
    "prospect_reply",
    "meeting",
    "completed_task",
    "note",
    "marketing_event",
  ]),
  occurredAt: z.iso.datetime({ offset: true }),
  companyId: nullableString,
  contactId: nullableString,
  dealId: nullableString,
  requiresDisposition: z.boolean().optional(),
  outcome: nullableString.optional(),
});

const taskSchema = z.object({
  id: z.string().min(1),
  ownerId: nullableString,
  dealId: nullableString,
  dueAt: z.iso.datetime({ offset: true }),
  status: z.enum(["open", "complete"]),
});

export const fixtureReleaseSchema = z.object({
  release: z.string().min(1),
  healthRuleVersion: z.string().min(1),
  config: z.object({
    asOf: z.iso.datetime({ offset: true }),
    reportingTimeZone: z.string().min(1),
    staleDealDays: z.number().int().positive(),
    staleContactDays: z.number().int().positive(),
    newBusinessPipeline: z.string().min(1),
  }),
  owners: z.array(ownerSchema),
  companies: z.array(companySchema),
  contacts: z.array(contactSchema),
  deals: z.array(dealSchema),
  activities: z.array(activitySchema),
  tasks: z.array(taskSchema),
});
