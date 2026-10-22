import { LemlistClient } from "./client.ts";
import type { LemlistConnectionConfig } from "./config.ts";
import { LemlistTransport, type FetchLike } from "./transport.ts";

export function connectLemlist(config: LemlistConnectionConfig, fetchImpl: FetchLike = fetch): LemlistClient {
  return new LemlistClient(
    new LemlistTransport({
      apiKey: config.apiKey,
      guards: { launchEnabled: config.launchEnabled },
      fetch: fetchImpl,
    }),
  );
}
