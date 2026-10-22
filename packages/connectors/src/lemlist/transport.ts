// Guarded HTTP boundary for the Lemlist API (decision 0012). Every call passes
// assertAllowedRequest before fetch is reached: only the listed resources are
// reachable and starting a campaign fails closed unless launch is explicitly
// enabled. Anchorpoint runs as a real company, so any campaign and any lead
// domain may be written, but no outreach ever happens: before a lead is added
// or a campaign started, the transport reads GET /api/team/senders and refuses
// the write if any sender is attached to that campaign.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class LemlistGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LemlistGuardError";
  }
}

export class LemlistHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, method: string, path: string, body: string) {
    super(`Lemlist ${method} ${path} failed with ${status}: ${body}`);
    this.name = "LemlistHttpError";
    this.status = status;
    this.body = body;
  }
}

export interface LemlistRequest {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
}

export interface TransportGuards {
  launchEnabled: boolean;
}

export const lemlistApiBaseUrl = "https://api.lemlist.com";

const segment = "[^/]+";
const reads = [
  /^\/api\/team$/,
  /^\/api\/team\/senders$/,
  /^\/api\/campaigns$/,
  new RegExp(`^/api/leads/${segment}$`),
  /^\/api\/activities$/,
  /^\/api\/unsubscribes$/,
  /^\/api\/hooks$/,
];
const createCampaignPath = /^\/api\/campaigns$/;
const addLeadPath = new RegExp(`^/api/campaigns/(${segment})/leads/?$`);
const campaignStatePath = new RegExp(`^/api/campaigns/(${segment})/(start|pause)$`);
const unsubscribePath = new RegExp(`^/api/unsubscribes/(${segment})$`);
const hooksPath = /^\/api\/hooks$/;

const teamSendersPath = "/api/team/senders";

// The campaign whose senders must be checked before this request may run, or null.
export function senderCheckedCampaign(request: LemlistRequest): string | null {
  if (request.method !== "POST") return null;
  const lead = addLeadPath.exec(request.path);
  if (lead) return decodeURIComponent(lead[1]!);
  const state = campaignStatePath.exec(request.path);
  if (state && state[2] === "start") return decodeURIComponent(state[1]!);
  return null;
}

// Reads a GET /api/team/senders response (developer.lemlist.com, retrieved
// 2026-10-22): an array of { userId, campaigns: [{ _id, name, status,
// sendingChannels }] }. Anything unreadable counts as a sender, so the check
// fails closed.
export function sendersAttachedTo(response: unknown, campaignId: string): string[] {
  if (!Array.isArray(response)) return ["unreadable /api/team/senders response"];
  const senders: string[] = [];
  for (const sender of response) {
    const campaigns = (sender as { campaigns?: unknown })?.campaigns;
    const userId = String((sender as { userId?: unknown })?.userId ?? "unknown sender");
    if (!Array.isArray(campaigns)) {
      senders.push(userId);
      continue;
    }
    if (campaigns.some((campaign) => (campaign as { _id?: unknown })?._id === campaignId)) senders.push(userId);
  }
  return senders;
}

export function assertAllowedRequest(request: LemlistRequest, guards: TransportGuards): void {
  const { method, path } = request;
  if (method === "GET") {
    if (request.body !== undefined) throw new LemlistGuardError("Refused GET with a body.");
    if (!reads.some((pattern) => pattern.test(path))) throw new LemlistGuardError(`Refused GET ${path}: not an allowed resource.`);
    return;
  }
  if (createCampaignPath.test(path) || hooksPath.test(path) || unsubscribePath.test(path)) return;

  if (addLeadPath.test(path)) {
    if (!String(request.body?.email ?? "").includes("@")) throw new LemlistGuardError("Refused lead without an email address.");
    return;
  }

  const state = campaignStatePath.exec(path);
  if (state) {
    if (state[2] === "start" && !guards.launchEnabled) {
      throw new LemlistGuardError("Refused campaign start: launch is switched off (decision 0012).");
    }
    return;
  }
  throw new LemlistGuardError(`Refused ${method} ${path}: not an allowed Lemlist resource.`);
}

export interface LemlistTransportOptions {
  apiKey: string;
  guards: TransportGuards;
  baseUrl?: string;
  fetch?: FetchLike;
}

export class LemlistTransport {
  readonly #baseUrl: string;
  readonly #authorization: string;
  readonly #guards: TransportGuards;
  readonly #fetch: FetchLike;

  constructor(options: LemlistTransportOptions) {
    this.#baseUrl = options.baseUrl ?? lemlistApiBaseUrl;
    if (!this.#baseUrl.startsWith("https://")) throw new Error("The Lemlist base URL must use https.");
    // Lemlist uses Basic auth with an empty login and the API key as the password.
    this.#authorization = `Basic ${Buffer.from(`:${options.apiKey}`).toString("base64")}`;
    this.#guards = options.guards;
    this.#fetch = options.fetch ?? fetch;
  }

  get guards(): TransportGuards {
    return this.#guards;
  }

  // Returns the parsed body, or null for a 404 so callers can treat "not found" as data.
  async send(request: LemlistRequest, options: { notFoundAsNull?: boolean } = {}): Promise<unknown> {
    assertAllowedRequest(request, this.#guards);
    const checked = senderCheckedCampaign(request);
    if (checked !== null) {
      // Re-read on every write, so a sender attached mid-run still stops it.
      const senders = sendersAttachedTo(await this.#call({ method: "GET", path: teamSendersPath }, {}), checked);
      if (senders.length > 0) {
        throw new LemlistGuardError(`Refused write to campaign ${checked}: it has a sender attached (${senders.join(", ")}). No outreach ever happens.`);
      }
    }
    return this.#call(request, options);
  }

  async #call(request: LemlistRequest, options: { notFoundAsNull?: boolean }): Promise<unknown> {
    const target = new URL(request.path, this.#baseUrl);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) target.searchParams.set(key, String(value));
    }
    const response = await this.#fetch(target.toString(), {
      method: request.method,
      headers: {
        Accept: "application/json",
        Authorization: this.#authorization,
        ...(request.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    if (response.status === 404 && options.notFoundAsNull) return null;
    const text = await response.text();
    if (!response.ok) throw new LemlistHttpError(response.status, request.method, request.path, text.slice(0, 500));
    return text ? JSON.parse(text) : {};
  }
}
