// Read-only HTTP boundary for the Attio REST API (decision 0011). Every call passes
// through assertReadOnlyRequest before fetch is reached. Attio's record and list-entry
// queries are POSTs that read, so POST is allowed only on those query resources and only
// with a body made of query keys; every other POST, PUT, PATCH, or DELETE fails closed.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ReadOnlyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyViolationError";
  }
}

export interface ReadOnlyRequest {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

export const attioApiBaseUrl = "https://api.attio.com";

const getPaths = [/^\/v2\/self$/, /^\/v2\/workspace_members$/, /^\/v2\/tasks$/];
const recordQueryPath = /^\/v2\/objects\/[a-z0-9_-]+\/records\/query$/;
// List entries are read the same way (decision 0015: audience List membership is approval).
const listEntryQueryPath = /^\/v2\/lists\/[a-z0-9_-]+\/entries\/query$/;
const queryBodyKeys = new Set(["filter", "sorts", "limit", "offset"]);

export function assertReadOnlyRequest(request: ReadOnlyRequest, baseUrl: string): URL {
  const method = request.method.toUpperCase();
  const base = new URL(baseUrl);
  const target = new URL(request.url, base);
  if (target.origin !== base.origin) {
    throw new ReadOnlyViolationError(`Refused request to ${target.origin}: only ${base.origin} is allowed.`);
  }
  if (method === "GET") {
    if (request.body !== undefined) throw new ReadOnlyViolationError("Refused GET with a body.");
    if (!getPaths.some((pattern) => pattern.test(target.pathname))) {
      throw new ReadOnlyViolationError(`Refused GET ${target.pathname}: not an allowed read resource.`);
    }
    return target;
  }
  if (method === "POST" && (recordQueryPath.test(target.pathname) || listEntryQueryPath.test(target.pathname))) {
    const keys = Object.keys(request.body ?? {});
    const foreign = keys.filter((key) => !queryBodyKeys.has(key));
    if (foreign.length > 0) {
      throw new ReadOnlyViolationError(`Refused record query with non-query keys: ${foreign.join(", ")}.`);
    }
    return target;
  }
  throw new ReadOnlyViolationError(
    `Refused ${method} ${target.pathname}: the Attio connector is read-only and allows only GET reads and record queries.`,
  );
}

export interface ReadOnlyTransportOptions {
  baseUrl?: string;
  accessToken: string;
  fetch?: FetchLike;
}

export class AttioHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AttioHttpError";
    this.status = status;
  }
}

export class ReadOnlyTransport {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #fetch: FetchLike;

  constructor(options: ReadOnlyTransportOptions) {
    this.#baseUrl = options.baseUrl ?? attioApiBaseUrl;
    if (!this.#baseUrl.startsWith("https://")) throw new Error("The Attio base URL must use https.");
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetch ?? fetch;
  }

  async send(request: ReadOnlyRequest): Promise<unknown> {
    const target = assertReadOnlyRequest(request, this.#baseUrl);
    const method = request.method.toUpperCase();
    const response = await this.#fetch(target.toString(), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.#accessToken}`,
        ...(request.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new AttioHttpError(response.status, `Attio ${method} ${target.pathname} failed with ${response.status}: ${body}`);
    }
    return response.json();
  }
}
