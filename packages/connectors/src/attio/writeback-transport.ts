// Scoped write boundary for enrichment writeback into Attio. It is separate from
// the read-only sync transport, which stays read-only by construction. Every call
// passes assertWritebackRequest before fetch is reached. Allowed are exactly:
// creating a Person that links to a Company, and updating whitelisted enrichment
// attributes on an existing Person or Company. Everything else fails closed:
// reads, deletes, asserts, other objects, other attributes, query strings, hosts.

import { attioApiBaseUrl, AttioHttpError, type FetchLike } from "./transport.ts";

export class WritebackScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WritebackScopeError";
  }
}

// The enrichment attributes writeback may set. Company location and domain come
// from Clay; the person attributes are the contact fields Clay proposes plus the
// provenance stamp. Owner, lifecycle, consent, and every other attribute stay human.
export const companyWritebackAttributes = ["domains", "primary_location"] as const;
export const personWritebackAttributes = [
  "name",
  "job_title",
  "email_addresses",
  "linkedin",
  "persona",
  "persona_verified",
  "enrichment_source",
  "enrichment_date",
] as const;

export type CompanyWritebackAttribute = (typeof companyWritebackAttributes)[number];
export type PersonWritebackAttribute = (typeof personWritebackAttributes)[number];

const companyAllowed = new Set<string>(companyWritebackAttributes);
const personAllowed = new Set<string>(personWritebackAttributes);

export interface WritebackRequest {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

const createPersonPath = /^\/v2\/objects\/people\/records$/;
const updatePath = /^\/v2\/objects\/(people|companies)\/records\/([A-Za-z0-9-]+)$/;

function valuesOf(body: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!body) throw new WritebackScopeError("Refused write without a body.");
  const outer = Object.keys(body);
  if (outer.length !== 1 || outer[0] !== "data") throw new WritebackScopeError("Refused body: only { data: { values } } is allowed.");
  const data = body.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new WritebackScopeError("Refused body: data must be an object.");
  const inner = Object.keys(data);
  if (inner.length !== 1 || inner[0] !== "values") throw new WritebackScopeError("Refused body: data may hold only values.");
  const values = (data as Record<string, unknown>).values;
  if (typeof values !== "object" || values === null || Array.isArray(values)) throw new WritebackScopeError("Refused body: values must be an object.");
  if (Object.keys(values).length === 0) throw new WritebackScopeError("Refused body: values is empty.");
  return values as Record<string, unknown>;
}

function assertAttributes(values: Record<string, unknown>, allowed: Set<string>, what: string): void {
  const foreign = Object.keys(values).filter((key) => !allowed.has(key));
  if (foreign.length > 0) throw new WritebackScopeError(`Refused ${what}: attributes outside the writeback scope: ${foreign.join(", ")}.`);
}

function assertCompanyLink(value: unknown): void {
  const links = Array.isArray(value) ? value : [];
  const valid =
    links.length === 1 &&
    typeof links[0] === "object" &&
    links[0] !== null &&
    (links[0] as Record<string, unknown>).target_object === "companies" &&
    typeof (links[0] as Record<string, unknown>).target_record_id === "string" &&
    ((links[0] as Record<string, unknown>).target_record_id as string).length > 0;
  if (!valid) throw new WritebackScopeError("Refused person create: it must link to exactly one existing Company.");
}

export function assertWritebackRequest(request: WritebackRequest, baseUrl: string): URL {
  const method = request.method.toUpperCase();
  const base = new URL(baseUrl);
  const target = new URL(request.url, base);
  if (target.origin !== base.origin) {
    throw new WritebackScopeError(`Refused request to ${target.origin}: only ${base.origin} is allowed.`);
  }
  if (target.search !== "" || target.hash !== "") throw new WritebackScopeError("Refused write with a query string.");

  if (method === "POST" && createPersonPath.test(target.pathname)) {
    const values = valuesOf(request.body);
    const { company, ...rest } = values;
    assertCompanyLink(company);
    assertAttributes(rest, personAllowed, "person create");
    if (!("name" in rest)) throw new WritebackScopeError("Refused person create without a name.");
    return target;
  }
  const update = updatePath.exec(target.pathname);
  if (method === "PATCH" && update) {
    const values = valuesOf(request.body);
    assertAttributes(values, update[1] === "people" ? personAllowed : companyAllowed, `${update[1]} update`);
    return target;
  }
  throw new WritebackScopeError(
    `Refused ${method} ${target.pathname}: writeback allows only person create and whitelisted enrichment updates.`,
  );
}

// Maps a writeback attribute name to the slug the workspace actually uses. Attio
// reserves the slug of a deleted attribute, so a recreated one can carry a suffix.
export type WritebackSlugs = Readonly<Record<string, string>>;

function renameKeys(values: Record<string, unknown>, map: WritebackSlugs): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [map[key] ?? key, value]));
}

// Applies the slug map to an outgoing body. The scope check runs on writeback names first.
function withWorkspaceSlugs(body: Record<string, unknown> | undefined, slugs: WritebackSlugs): Record<string, unknown> | undefined {
  if (!body || Object.keys(slugs).length === 0) return body;
  const values = (body.data as { values: Record<string, unknown> }).values;
  return { data: { values: renameKeys(values, slugs) } };
}

// Renames a workspace record's values back to writeback names, so planning compares like with like.
export function toWritebackNames(values: Record<string, unknown>, slugs: WritebackSlugs): Record<string, unknown> {
  const reverse = Object.fromEntries(Object.entries(slugs).map(([name, slug]) => [slug, name]));
  return renameKeys(values, reverse);
}

export interface WritebackTransportOptions {
  baseUrl?: string;
  accessToken: string;
  fetch?: FetchLike;
  slugs?: WritebackSlugs;
}

export class WritebackTransport {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #fetch: FetchLike;
  readonly #slugs: WritebackSlugs;

  constructor(options: WritebackTransportOptions) {
    this.#baseUrl = options.baseUrl ?? attioApiBaseUrl;
    if (!this.#baseUrl.startsWith("https://")) throw new Error("The Attio base URL must use https.");
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetch ?? fetch;
    this.#slugs = options.slugs ?? {};
  }

  async send(request: WritebackRequest): Promise<unknown> {
    const target = assertWritebackRequest(request, this.#baseUrl);
    const method = request.method.toUpperCase();
    request = { ...request, body: withWorkspaceSlugs(request.body, this.#slugs) };
    const response = await this.#fetch(target.toString(), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.#accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new AttioHttpError(response.status, `Attio ${method} ${target.pathname} failed with ${response.status}: ${body}`);
    }
    return response.json();
  }
}

type Env = Record<string, string | undefined>;

export interface AttioWritebackConfig {
  connectionId: string;
  accessToken: string;
  slugs: WritebackSlugs;
}

// ATTIO_WRITEBACK_SLUGS holds comma-separated name=slug pairs, such as
// "persona_verified=persona_verified_7". Only writeback attribute names may be mapped.
function slugsFromEnv(raw: string | undefined): WritebackSlugs {
  const slugs: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
    const [name, slug] = pair.split("=").map((part) => part.trim());
    if (!name || !slug || !(personAllowed.has(name) || companyAllowed.has(name))) {
      throw new Error(`ATTIO_WRITEBACK_SLUGS has an invalid pair: ${pair}`);
    }
    slugs[name] = slug;
  }
  return slugs;
}

// Returns null when no writeback token is configured. The writeback token must be a
// separate token from the read-only sync token, so the read path never gains scope.
export function attioWritebackConfigFromEnv(env: Env = process.env): AttioWritebackConfig | null {
  const accessToken = env.ATTIO_WRITEBACK_TOKEN;
  if (!accessToken) return null;
  const connectionId = env.ATTIO_CONNECTION_ID;
  if (!connectionId) throw new Error("ATTIO_CONNECTION_ID is required when ATTIO_WRITEBACK_TOKEN is set.");
  if (accessToken === env.ATTIO_ACCESS_TOKEN) {
    throw new Error("ATTIO_WRITEBACK_TOKEN must differ from the read-only ATTIO_ACCESS_TOKEN.");
  }
  return { connectionId, accessToken, slugs: slugsFromEnv(env.ATTIO_WRITEBACK_SLUGS) };
}
