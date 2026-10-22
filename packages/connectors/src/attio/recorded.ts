import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { FetchLike } from "./transport.ts";

// Replays hand-written, synthetic Attio responses from a fixture scenario
// directory. It stands in for fetch, so every request still passes the read-only
// transport first; anything it receives is logged for assertions.

const manifestSchema = z.object({
  synthetic: z.literal(true),
  baseUrl: z.url(),
  responses: z.array(
    z.object({
      method: z.enum(["GET", "POST"]),
      path: z.string().startsWith("/v2/"),
      offset: z.number().int().nonnegative().default(0),
      file: z.string().min(1),
    }),
  ),
});

export type RecordedManifest = z.infer<typeof manifestSchema>;

export interface RecordedRequest {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

export interface RecordedAttio {
  manifest: RecordedManifest;
  fetch: FetchLike;
  requests: RecordedRequest[];
}

const emptyPage = JSON.stringify({ data: [] });

export function loadRecordedScenario(directory: string): RecordedAttio {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")));
  const requests: RecordedRequest[] = [];

  const recordedFetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    requests.push({ method, url: input, body });
    if (method !== "GET" && method !== "POST") return new Response("recorded fixtures are read-only", { status: 405 });

    const offset = Number(body?.offset ?? url.searchParams.get("offset") ?? 0);
    const entry = manifest.responses.find(
      (candidate) => candidate.method === method && candidate.path === url.pathname && candidate.offset === offset,
    );
    // A page past the recorded ones is an empty page, the way Attio ends offset paging.
    const content = entry ? readFileSync(resolve(directory, entry.file), "utf8") : offset > 0 ? emptyPage : null;
    if (content === null) {
      return new Response(JSON.stringify({ code: "not_recorded", message: `No recording for ${method} ${url.pathname}` }), {
        status: 404,
      });
    }
    return new Response(content, { status: 200, headers: { "Content-Type": "application/json" } });
  };

  return { manifest, fetch: recordedFetch, requests };
}
