import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Lemlist activity events, from webhooks or the activities endpoint, mapped to the
// few outcomes the application acts on. Unsubscribes and bounces become
// suppressions. Lemlist authenticates webhooks only by echoing a shared secret in
// the body, so the receiver compares it in constant time.

export const lemlistEventSchema = z.object({
  _id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Expected an ISO datetime."),
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
  leadEmail: z.string().optional(),
  email: z.string().optional(),
  secret: z.string().optional(),
}).catchall(z.unknown());

export type LemlistEventCategory =
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "interested"
  | "not_interested"
  | "bounced"
  | "unsubscribed"
  | "other";

const categories: Record<string, LemlistEventCategory> = {
  emailsSent: "sent",
  emailsOpened: "opened",
  emailsClicked: "clicked",
  emailsReplied: "replied",
  emailsInterested: "interested",
  emailsNotInterested: "not_interested",
  emailsBounced: "bounced",
  emailsUnsubscribed: "unsubscribed",
  apiUnsubscribed: "unsubscribed",
  manualUnsubscribed: "unsubscribed",
  entityUnsubscribed: "unsubscribed",
  variableUnsubscribed: "unsubscribed",
};

export interface NormalizedEvent {
  activityId: string;
  type: string;
  category: LemlistEventCategory;
  campaignId: string | null;
  leadId: string | null;
  email: string | null;
  occurredAt: string;
  suppress: boolean;
  payload: Record<string, unknown>;
}

export class WebhookSecretError extends Error {
  constructor() {
    super("Webhook secret is missing or does not match.");
    this.name = "WebhookSecretError";
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest();

export function normalizeEvent(raw: unknown, expectedSecret?: string): NormalizedEvent {
  const event = lemlistEventSchema.parse(raw);
  if (expectedSecret !== undefined && !timingSafeEqual(digest(event.secret ?? ""), digest(expectedSecret))) {
    throw new WebhookSecretError();
  }
  const { secret: _secret, ...payload } = event;
  const category = categories[event.type] ?? "other";
  const email = event.leadEmail ?? event.email ?? null;
  return {
    activityId: event._id,
    type: event.type,
    category,
    campaignId: event.campaignId ?? null,
    leadId: event.leadId ?? null,
    email: email ? email.trim().toLowerCase() : null,
    occurredAt: new Date(event.createdAt).toISOString(),
    suppress: category === "unsubscribed" || category === "bounced",
    payload,
  };
}

export interface EventStore {
  // Inserts the event once; false when its activity ID was already recorded.
  record(event: NormalizedEvent): Promise<boolean>;
  suppress(email: string, reason: string): Promise<void>;
}

export async function ingestEvent(store: EventStore, event: NormalizedEvent): Promise<"recorded" | "duplicate"> {
  const inserted = await store.record(event);
  if (!inserted) return "duplicate";
  if (event.suppress && event.email) await store.suppress(event.email, `lemlist ${event.type}`);
  return "recorded";
}

export class InMemoryEventStore implements EventStore {
  readonly events = new Map<string, NormalizedEvent>();
  readonly suppressed = new Map<string, string>();

  async record(event: NormalizedEvent): Promise<boolean> {
    if (this.events.has(event.activityId)) return false;
    this.events.set(event.activityId, event);
    return true;
  }

  async suppress(email: string, reason: string): Promise<void> {
    if (!this.suppressed.has(email)) this.suppressed.set(email, reason);
  }
}
