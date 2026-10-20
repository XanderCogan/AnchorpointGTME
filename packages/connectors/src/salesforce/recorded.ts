import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { FetchLike } from "./transport.ts";

// Replays hand-written, synthetic Salesforce query responses from a fixture
// scenario directory. It stands in for fetch, so every request still passes the
// read-only transport first; anything it receives is logged for assertions.

const manifestSchema = z.object({
  synthetic: z.literal(true),
  instanceUrl: z.url(),
  apiVersion: z.string(),
  responses: z.array(
    z.union([
      z.object({ object: z.string().min(1), file: z.string().min(1) }),
      z.object({ path: z.string().startsWith("/services/data/"), file: z.string().min(1) }),
    ]),
  ),
});

export type RecordedManifest = z.infer<typeof manifestSchema>;

export interface RecordedRequest {
  method: string;
  url: string;
  soql: string | null;
}

export interface RecordedSalesforce {
  manifest: RecordedManifest;
  fetch: FetchLike;
  requests: RecordedRequest[];
}

export function loadRecordedScenario(directory: string): RecordedSalesforce {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")));
  const requests: RecordedRequest[] = [];
  const body = (file: string): string => readFileSync(resolve(directory, file), "utf8");

  const recordedFetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const soql = url.searchParams.get("q");
    requests.push({ method, url: input, soql });
    if (method !== "GET") return new Response("recorded fixtures are read-only", { status: 405 });

    const object = soql?.match(/\bFROM\s+([A-Za-z0-9_]+)/i)?.[1];
    const entry = manifest.responses.find((candidate) =>
      "object" in candidate ? soql !== null && candidate.object === object : candidate.path === url.pathname,
    );
    if (!entry) {
      return new Response(JSON.stringify([{ errorCode: "NOT_RECORDED", message: `No recording for ${url.pathname}` }]), {
        status: 404,
      });
    }
    return new Response(body(entry.file), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  return { manifest, fetch: recordedFetch, requests };
}
