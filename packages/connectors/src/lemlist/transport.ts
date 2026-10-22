// Guarded HTTP boundary for the Lemlist API (decision 0012). Every call passes
// assertAllowedRequest before fetch is reached: only the listed resources are
// reachable, campaign writes are limited to the configured test campaign, leads
// are limited to allowed email domains, and starting a campaign fails closed
// unless launch is explicitly enabled.

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
  campaignId: string | null;
  allowedLeadDomains: string[] | "*";
  launchEnabled: boolean;
}

export const lemlistApiBaseUrl = "https://api.lemlist.com";

const segment = "[^/]+";
const reads = [
  /^\/api\/team$/,
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

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

function assertCampaign(campaignId: string, guards: TransportGuards): void {
  if (guards.campaignId === null || decodeURIComponent(campaignId) !== guards.campaignId) {
    throw new LemlistGuardError(`Refused write to campaign ${campaignId}: only the configured test campaign is writable.`);
  }
}

export function assertAllowedRequest(request: LemlistRequest, guards: TransportGuards): void {
  const { method, path } = request;
  if (method === "GET") {
    if (request.body !== undefined) throw new LemlistGuardError("Refused GET with a body.");
    if (!reads.some((pattern) => pattern.test(path))) throw new LemlistGuardError(`Refused GET ${path}: not an allowed resource.`);
    return;
  }
  if (createCampaignPath.test(path) || hooksPath.test(path) || unsubscribePath.test(path)) return;

  const lead = addLeadPath.exec(path);
  if (lead) {
    assertCampaign(lead[1]!, guards);
    const email = String(request.body?.email ?? "");
    if (!email.includes("@")) throw new LemlistGuardError("Refused lead without an email address.");
    const domain = domainOf(email);
    const allowed = guards.allowedLeadDomains === "*" ||
      guards.allowedLeadDomains.some((allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`));
    if (!allowed) {
      throw new LemlistGuardError(`Refused lead at ${domainOf(email)}: only ${String(guards.allowedLeadDomains)} leads are allowed.`);
    }
    return;
  }

  const state = campaignStatePath.exec(path);
  if (state) {
    assertCampaign(state[1]!, guards);
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
