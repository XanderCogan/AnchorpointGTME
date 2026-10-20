import { SalesforceTokenProvider } from "./auth.ts";
import { SalesforceReadClient } from "./client.ts";
import type { SalesforceConnectionConfig } from "./config.ts";
import { loadRecordedScenario, type RecordedSalesforce } from "./recorded.ts";
import { ReadOnlyTransport, type FetchLike } from "./transport.ts";

// Live client for a configured org. Nothing calls this until the Developer
// Edition org and its read-only integration user exist.
export async function connectSalesforce(
  config: SalesforceConnectionConfig,
  fetchImpl: FetchLike = fetch,
): Promise<SalesforceReadClient> {
  const tokens = new SalesforceTokenProvider(config.auth, fetchImpl);
  const { instanceUrl } = await tokens.session();
  const transport = new ReadOnlyTransport({
    instanceUrl,
    apiVersion: config.apiVersion,
    accessToken: async () => (await tokens.session()).accessToken,
    invalidateToken: () => tokens.invalidate(),
    fetch: fetchImpl,
  });
  return new SalesforceReadClient(transport, config.apiVersion);
}

export function recordedSalesforce(directory: string): RecordedSalesforce & { client: SalesforceReadClient } {
  const recorded = loadRecordedScenario(directory);
  const transport = new ReadOnlyTransport({
    instanceUrl: recorded.manifest.instanceUrl,
    apiVersion: recorded.manifest.apiVersion,
    accessToken: async () => "recorded-fixture-token",
    fetch: recorded.fetch,
  });
  return { ...recorded, client: new SalesforceReadClient(transport, recorded.manifest.apiVersion) };
}
