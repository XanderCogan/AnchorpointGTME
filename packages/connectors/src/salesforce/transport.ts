// Read-only HTTP boundary for Salesforce data requests. Every data call passes
// through assertReadOnlyRequest before fetch is reached, so a non-GET method, an
// endpoint outside the query allow-list, or a foreign host fails closed.

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
}

const apiVersionPattern = /^v\d{2,3}\.\d$/;

export function assertApiVersion(apiVersion: string): void {
  if (!apiVersionPattern.test(apiVersion)) {
    throw new Error(`Salesforce API version ${apiVersion} must look like v62.0.`);
  }
}

// Only the REST query resource and its query-locator continuation pages are allowed.
export function assertReadOnlyRequest(request: ReadOnlyRequest, instanceUrl: string, apiVersion: string): URL {
  if (request.method.toUpperCase() !== "GET") {
    throw new ReadOnlyViolationError(
      `Refused ${request.method.toUpperCase()} ${request.url}: the Salesforce connector is read-only and sends GET requests only.`,
    );
  }
  const instance = new URL(instanceUrl);
  const target = new URL(request.url, instance);
  if (target.origin !== instance.origin) {
    throw new ReadOnlyViolationError(`Refused request to ${target.origin}: only ${instance.origin} is allowed.`);
  }
  const queryPath = `/services/data/${apiVersion}/query`;
  const isQuery = target.pathname === queryPath && target.searchParams.has("q");
  const isContinuation = new RegExp(`^${queryPath.replaceAll(".", "\\.")}/[A-Za-z0-9]{15,18}-\\d+$`).test(
    target.pathname,
  );
  if (!isQuery && !isContinuation) {
    throw new ReadOnlyViolationError(`Refused ${target.pathname}: only the query resource is allowed.`);
  }
  if (isQuery && !/^\s*SELECT\s/i.test(target.searchParams.get("q") ?? "")) {
    throw new ReadOnlyViolationError("Refused query: SOQL must start with SELECT.");
  }
  return target;
}

export interface ReadOnlyTransportOptions {
  instanceUrl: string;
  apiVersion: string;
  accessToken: () => Promise<string>;
  invalidateToken?: () => void;
  fetch?: FetchLike;
}

export class SalesforceHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SalesforceHttpError";
    this.status = status;
  }
}

export class ReadOnlyTransport {
  readonly #options: ReadOnlyTransportOptions;
  readonly #fetch: FetchLike;

  constructor(options: ReadOnlyTransportOptions) {
    assertApiVersion(options.apiVersion);
    this.#options = options;
    this.#fetch = options.fetch ?? fetch;
  }

  // The method parameter exists so the refusal is enforced here rather than merely
  // absent from the public client; nothing in the connector passes anything but GET.
  async send(request: ReadOnlyRequest): Promise<unknown> {
    const target = assertReadOnlyRequest(request, this.#options.instanceUrl, this.#options.apiVersion);
    let response = await this.#get(target);
    if (response.status === 401 && this.#options.invalidateToken) {
      this.#options.invalidateToken();
      response = await this.#get(target);
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new SalesforceHttpError(response.status, `Salesforce GET ${target.pathname} failed with ${response.status}: ${body}`);
    }
    return response.json();
  }

  async #get(target: URL): Promise<Response> {
    return this.#fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await this.#options.accessToken()}`,
      },
    });
  }
}
