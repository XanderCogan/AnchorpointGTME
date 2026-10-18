import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildFindingViews } from "../../../packages/core/src/presentation.ts";
import { closePool, pool } from "../../../packages/db/src/client.ts";
import { latestAudit, listJobs } from "../../../packages/db/src/repository.ts";

const localToken = "anchorpoint-local-api-token";

function expectedToken(): string {
  if (process.env.INTERNAL_API_TOKEN) {
    if (
      process.env.NODE_ENV === "production" &&
      (process.env.INTERNAL_API_TOKEN.length < 32 ||
        process.env.INTERNAL_API_TOKEN.startsWith("replace-with-"))
    ) {
      throw new Error("INTERNAL_API_TOKEN must be a non-placeholder value of at least 32 characters.");
    }
    return process.env.INTERNAL_API_TOKEN;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("INTERNAL_API_TOKEN is required in production.");
  }
  return localToken;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function authorized(request: IncomingMessage): boolean {
  const prefix = "Bearer ";
  const header = request.headers.authorization ?? "";
  const received = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  return timingSafeEqual(digest(received), digest(expectedToken()));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      await pool().query("SELECT 1");
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (!authorized(request)) {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/audits/latest") {
      const audit = await latestAudit();
      if (!audit) {
        sendJson(response, 404, { error: "no_completed_audit" });
        return;
      }
      const release = audit.release;
      sendJson(response, 200, {
        auditRunId: audit.auditRunId,
        completedAt: audit.completedAt,
        release: release.release,
        healthRuleVersion: release.healthRuleVersion,
        auditAsOf: release.config.asOf,
        reportingTimeZone: release.config.reportingTimeZone,
        sourceRecordCount:
          release.owners.length +
          release.companies.length +
          release.contacts.length +
          release.deals.length +
          release.activities.length +
          release.tasks.length,
        findings: buildFindingViews(release, audit.findings),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/jobs") {
      sendJson(response, 200, { jobs: await listJobs() });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "internal_error" });
  }
});

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
server.listen(port, host, () => {
  console.log(`Anchorpoint API listening on http://${host}:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closePool();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
