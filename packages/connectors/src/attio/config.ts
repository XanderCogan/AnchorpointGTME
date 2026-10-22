// The connector authenticates with a workspace access token whose scopes are read
// only (record, object configuration, list, user management, and task reads). The
// GET-and-query-only transport is a second, independent guard.
export interface AttioConnectionConfig {
  // Stable local key for mirror rows, never a credential.
  connectionId: string;
  accessToken: string;
  siteObjectSlug?: string;
  callObjectSlug?: string;
}

type Env = Record<string, string | undefined>;

// Returns null when no token is configured. A token without a connection ID is an error.
export function attioConfigFromEnv(env: Env = process.env): AttioConnectionConfig | null {
  const accessToken = env.ATTIO_ACCESS_TOKEN;
  if (!accessToken) return null;
  const connectionId = env.ATTIO_CONNECTION_ID;
  if (!connectionId) throw new Error("ATTIO_CONNECTION_ID is required when ATTIO_ACCESS_TOKEN is set.");
  return {
    connectionId,
    accessToken,
    siteObjectSlug: env.ATTIO_SITE_OBJECT,
    callObjectSlug: env.ATTIO_CALL_OBJECT,
  };
}
