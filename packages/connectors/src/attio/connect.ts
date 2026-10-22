import { AttioReadClient } from "./client.ts";
import type { AttioConnectionConfig } from "./config.ts";
import { loadRecordedScenario, type RecordedAttio } from "./recorded.ts";
import { ReadOnlyTransport, type FetchLike } from "./transport.ts";

// Live client for the configured workspace.
export function connectAttio(config: AttioConnectionConfig, fetchImpl: FetchLike = fetch): AttioReadClient {
  return new AttioReadClient(new ReadOnlyTransport({ accessToken: config.accessToken, fetch: fetchImpl }));
}

export function recordedAttio(directory: string): RecordedAttio & { client: AttioReadClient } {
  const recorded = loadRecordedScenario(directory);
  const transport = new ReadOnlyTransport({
    baseUrl: recorded.manifest.baseUrl,
    accessToken: "recorded-fixture-token",
    fetch: recorded.fetch,
  });
  return { ...recorded, client: new AttioReadClient(transport) };
}
