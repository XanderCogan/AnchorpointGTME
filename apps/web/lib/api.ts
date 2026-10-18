import type { FindingView } from "../../../packages/core/src/presentation.ts";
import type { JobView } from "../../../packages/db/src/repository.ts";

export interface LatestAuditResponse {
  auditRunId: string;
  completedAt: string;
  release: string;
  healthRuleVersion: string;
  auditAsOf: string;
  reportingTimeZone: string;
  sourceRecordCount: number;
  findings: FindingView[];
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:4000";
}

function apiToken(): string {
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
  return "anchorpoint-local-api-token";
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${apiToken()}` },
  });
  if (!response.ok) throw new Error(`Anchorpoint API ${path} returned ${response.status}.`);
  return (await response.json()) as T;
}

export function getLatestAudit(): Promise<LatestAuditResponse> {
  return apiGet<LatestAuditResponse>("/v1/audits/latest");
}

export async function getJobs(): Promise<JobView[]> {
  return (await apiGet<{ jobs: JobView[] }>("/v1/jobs")).jobs;
}
