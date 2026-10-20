import { createSign } from "node:crypto";
import { z } from "zod";
import type { SalesforceAuthConfig } from "./config.ts";
import type { FetchLike } from "./transport.ts";

// The token exchange is the connector's only POST. It goes to the OAuth token
// endpoint on the configured login host, carries no record data, and cannot reach
// the data API, which stays behind the GET-only transport.
const tokenPath = "/services/oauth2/token";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  instance_url: z.url(),
});

export interface SalesforceSession {
  accessToken: string;
  instanceUrl: string;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signJwtAssertion(
  auth: Extract<SalesforceAuthConfig, { flow: "jwt_bearer" }>,
  now: Date = new Date(),
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: auth.clientId,
      sub: auth.username,
      aud: auth.audience,
      // Salesforce accepts assertions that expire within three minutes.
      exp: Math.floor(now.getTime() / 1000) + 180,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${base64url(signer.sign(auth.privateKeyPem))}`;
}

export function tokenRequestBody(auth: SalesforceAuthConfig, now?: Date): URLSearchParams {
  if (auth.flow === "client_credentials") {
    return new URLSearchParams({
      grant_type: "client_credentials",
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    });
  }
  return new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signJwtAssertion(auth, now),
  });
}

// Caches one session and refetches after invalidate(), which the transport calls
// once on a 401.
export class SalesforceTokenProvider {
  readonly #auth: SalesforceAuthConfig;
  readonly #fetch: FetchLike;
  #session: Promise<SalesforceSession> | undefined;

  constructor(auth: SalesforceAuthConfig, fetchImpl: FetchLike = fetch) {
    this.#auth = auth;
    this.#fetch = fetchImpl;
  }

  session(): Promise<SalesforceSession> {
    this.#session ??= this.#requestToken().catch((error: unknown) => {
      this.#session = undefined;
      throw error;
    });
    return this.#session;
  }

  invalidate(): void {
    this.#session = undefined;
  }

  async #requestToken(): Promise<SalesforceSession> {
    const response = await this.#fetch(new URL(tokenPath, this.#auth.loginUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenRequestBody(this.#auth),
    });
    if (!response.ok) {
      // Error bodies name the failure (invalid_grant, invalid_client) without secrets.
      throw new Error(`Salesforce token request failed with ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const token = tokenResponseSchema.parse(await response.json());
    return { accessToken: token.access_token, instanceUrl: token.instance_url };
  }
}
