import { z } from "zod";
import { LemlistHttpError, type LemlistTransport } from "./transport.ts";

// Response shapes follow developer.lemlist.com (retrieved 2026-10-22). Objects are
// kept loose beyond the fields this application reads.

export const campaignSchema = z.object({ _id: z.string().min(1), name: z.string().optional() }).catchall(z.unknown());

const createdLeadSchema = z.object({ _id: z.string().min(1), campaignId: z.string().optional(), email: z.string().optional() }).catchall(z.unknown());

export const leadSchema = z.object({
  _id: z.string().min(1),
  state: z.string().optional(),
  campaign: z.object({ id: z.string() }).catchall(z.unknown()).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
}).catchall(z.unknown());

export const activitySchema = z.object({
  _id: z.string().min(1),
  type: z.string().min(1),
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
  leadEmail: z.string().optional(),
  createdAt: z.string(),
}).catchall(z.unknown());

export const unsubscribeSchema = z.object({
  _id: z.string().min(1),
  email: z.string().optional(),
  value: z.string().optional(),
}).catchall(z.unknown());

const campaignStateSchema = z.object({ _id: z.string(), state: z.string() });
const hookSchema = z.object({ _id: z.string(), targetUrl: z.string() }).catchall(z.unknown());

export type LemlistCampaign = z.infer<typeof campaignSchema>;
export type LemlistLead = z.infer<typeof leadSchema>;
export type LemlistActivity = z.infer<typeof activitySchema>;
export type LemlistUnsubscribe = z.infer<typeof unsubscribeSchema>;

export interface LeadInput {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
  jobTitle?: string;
  phone?: string;
  // Stored by Lemlist as custom variables, for example the application's contact key.
  variables?: Record<string, string>;
}

export type AddLeadResult =
  | { status: "created"; leadId: string }
  | { status: "already_in_campaign" }
  | { status: "in_other_campaign" };

export interface PageOptions {
  pageSize: number;
  maxPages: number;
}

export class LemlistClient {
  readonly #transport: LemlistTransport;

  constructor(transport: LemlistTransport) {
    this.#transport = transport;
  }

  async team(): Promise<Record<string, unknown>> {
    return z.record(z.string(), z.unknown()).parse(await this.#transport.send({ method: "GET", path: "/api/team" }));
  }

  async listCampaigns(): Promise<LemlistCampaign[]> {
    return z.array(campaignSchema).parse(await this.#transport.send({ method: "GET", path: "/api/campaigns" }));
  }

  // autoReview stays false so added leads wait for review instead of launching.
  async createCampaign(name: string, timezone = "America/New_York"): Promise<LemlistCampaign> {
    return campaignSchema.parse(
      await this.#transport.send({ method: "POST", path: "/api/campaigns", body: { name, timezone, autoReview: false } }),
    );
  }

  async pauseCampaign(campaignId: string): Promise<string> {
    const path = `/api/campaigns/${encodeURIComponent(campaignId)}/pause`;
    return campaignStateSchema.parse(await this.#transport.send({ method: "POST", path })).state;
  }

  // Refused by the transport unless launch is enabled, which this project never does.
  async startCampaign(campaignId: string): Promise<string> {
    const path = `/api/campaigns/${encodeURIComponent(campaignId)}/start`;
    return campaignStateSchema.parse(await this.#transport.send({ method: "POST", path })).state;
  }

  // deduplicate=true makes Lemlist refuse a contact already in another campaign. A
  // repeat add to the same campaign is a 400 that writes nothing; both are results,
  // not failures, so retries stay idempotent.
  async addLead(campaignId: string, lead: LeadInput): Promise<AddLeadResult> {
    const { variables, ...fields } = lead;
    try {
      const created = createdLeadSchema.parse(
        await this.#transport.send({
          method: "POST",
          path: `/api/campaigns/${encodeURIComponent(campaignId)}/leads/`,
          query: { deduplicate: true },
          body: { ...variables, ...fields },
        }),
      );
      return { status: "created", leadId: created._id };
    } catch (error) {
      if (error instanceof LemlistHttpError) {
        if (error.status === 400 && /already in the campaign|LEAD_ALREADY_IN_CAMPAIGN/i.test(error.body)) {
          return { status: "already_in_campaign" };
        }
        if (error.status === 409 && /other campaign|LEAD_ALREADY_IN_OTHER_CAMPAIGN/i.test(error.body)) {
          return { status: "in_other_campaign" };
        }
      }
      throw error;
    }
  }

  async findLeads(email: string): Promise<LemlistLead[]> {
    const response = await this.#transport.send(
      { method: "GET", path: `/api/leads/${encodeURIComponent(email)}`, query: { version: "v2" } },
      { notFoundAsNull: true },
    );
    return response === null ? [] : z.array(leadSchema).parse(response);
  }

  async *listActivities(
    filter: { campaignId?: string; type?: string; minDate?: string },
    options: PageOptions,
  ): AsyncGenerator<LemlistActivity[]> {
    yield* this.#pages("/api/activities", { version: "v2", ...filter }, activitySchema, options);
  }

  async *listUnsubscribes(options: PageOptions): AsyncGenerator<LemlistUnsubscribe[]> {
    yield* this.#pages("/api/unsubscribes", {}, unsubscribeSchema, options);
  }

  async addUnsubscribe(email: string): Promise<LemlistUnsubscribe> {
    return unsubscribeSchema.parse(
      await this.#transport.send({ method: "POST", path: `/api/unsubscribes/${encodeURIComponent(email)}` }),
    );
  }

  // Lemlist echoes the secret in each webhook body; it is never returned by the API.
  async createWebhook(targetUrl: string, secret: string, campaignId?: string): Promise<{ _id: string; targetUrl: string }> {
    return hookSchema.parse(
      await this.#transport.send({ method: "POST", path: "/api/hooks", query: { campaignId }, body: { targetUrl, secret } }),
    );
  }

  async *#pages<T extends z.ZodType>(
    path: string,
    query: Record<string, string | undefined>,
    item: T,
    options: PageOptions,
  ): AsyncGenerator<z.infer<T>[]> {
    if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 100) {
      throw new Error("pageSize must be an integer from 1 to 100.");
    }
    for (let page = 0; ; page += 1) {
      if (page >= options.maxPages) throw new Error(`${path} exceeded the ${options.maxPages}-page bound before the last page.`);
      const raw = await this.#transport.send({
        method: "GET",
        path,
        query: { ...query, limit: options.pageSize, offset: page * options.pageSize },
      });
      // The reference documents bare arrays; a wrapped { data } page is accepted too.
      const rows = z.array(item).parse(Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data);
      yield rows;
      if (rows.length < options.pageSize) return;
    }
  }
}
