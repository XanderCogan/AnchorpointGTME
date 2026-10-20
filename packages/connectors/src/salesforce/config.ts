import { readFileSync } from "node:fs";
import { assertApiVersion } from "./transport.ts";

// Two server-to-server OAuth flows are supported. Both run as a dedicated
// integration user whose permission set grants read access only; the connector's
// own GET-only transport is a second, independent guard.
export type SalesforceAuthConfig =
  | {
      flow: "client_credentials";
      // My Domain URL, for example https://example-dev-ed.develop.my.salesforce.com
      loginUrl: string;
      clientId: string;
      clientSecret: string;
    }
  | {
      flow: "jwt_bearer";
      loginUrl: string;
      // The JWT audience: https://login.salesforce.com for Developer Edition orgs.
      audience: string;
      clientId: string;
      username: string;
      privateKeyPem: string;
    };

export interface SalesforceConnectionConfig {
  // Stable local key for mirror rows and watermarks, never a credential.
  connectionId: string;
  apiVersion: string;
  siteObjectApiName?: string;
  auth: SalesforceAuthConfig;
}

export const defaultApiVersion = "v62.0";

type Env = Record<string, string | undefined>;

// Returns null when no Salesforce flow is configured, which is the normal state
// until the Developer Edition org exists. Partial configuration is an error.
export function salesforceConfigFromEnv(env: Env = process.env): SalesforceConnectionConfig | null {
  const flow = env.SALESFORCE_AUTH_FLOW;
  if (!flow) return null;
  if (flow !== "client_credentials" && flow !== "jwt_bearer") {
    throw new Error(`SALESFORCE_AUTH_FLOW must be client_credentials or jwt_bearer, not ${flow}.`);
  }

  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is required when SALESFORCE_AUTH_FLOW=${flow}.`);
    return value;
  };
  const loginUrl = new URL(required("SALESFORCE_LOGIN_URL")).origin;
  if (!loginUrl.startsWith("https://")) throw new Error("SALESFORCE_LOGIN_URL must use https.");

  let auth: SalesforceAuthConfig;
  if (flow === "client_credentials") {
    auth = {
      flow,
      loginUrl,
      clientId: required("SALESFORCE_CLIENT_ID"),
      clientSecret: required("SALESFORCE_CLIENT_SECRET"),
    };
  } else {
    const keyPath = env.SALESFORCE_JWT_PRIVATE_KEY_PATH;
    const privateKeyPem = keyPath ? readFileSync(keyPath, "utf8") : required("SALESFORCE_JWT_PRIVATE_KEY");
    auth = {
      flow,
      loginUrl,
      audience: env.SALESFORCE_JWT_AUDIENCE ?? "https://login.salesforce.com",
      clientId: required("SALESFORCE_CLIENT_ID"),
      username: required("SALESFORCE_USERNAME"),
      privateKeyPem,
    };
  }

  const apiVersion = env.SALESFORCE_API_VERSION ?? defaultApiVersion;
  assertApiVersion(apiVersion);
  return {
    connectionId: required("SALESFORCE_CONNECTION_ID"),
    apiVersion,
    siteObjectApiName: env.SALESFORCE_SITE_OBJECT,
    auth,
  };
}
