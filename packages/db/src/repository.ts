import type { PoolClient } from "pg";
import type { Finding, FixtureRelease } from "../../core/src/types.ts";
import { pool, withTransaction } from "./client.ts";

export interface ClaimedJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export interface JobView {
  id: string;
  jobType: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface LatestAudit {
  auditRunId: string;
  status: "succeeded";
  completedAt: string;
  release: FixtureRelease;
  findings: Finding[];
}

export async function storeFixtureAndQueueAudit(
  release: FixtureRelease,
  sourceSha256: string,
): Promise<{ releaseId: string; queued: boolean }> {
  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: string; source_sha256: string }>(
      `INSERT INTO fixture_releases
        (release_name, health_rule_version, audit_as_of, source, source_sha256)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (release_name) DO NOTHING
       RETURNING id::text, source_sha256`,
      [
        release.release,
        release.healthRuleVersion,
        release.config.asOf,
        JSON.stringify(release),
        sourceSha256,
      ],
    );

    const stored =
      inserted.rows[0] ??
      (
        await client.query<{ id: string; source_sha256: string }>(
          "SELECT id::text, source_sha256 FROM fixture_releases WHERE release_name = $1",
          [release.release],
        )
      ).rows[0];

    if (!stored) throw new Error(`Fixture release ${release.release} could not be stored.`);
    if (stored.source_sha256 !== sourceSha256) {
      throw new Error(
        `Fixture release ${release.release} is immutable and its stored checksum differs from the input.`,
      );
    }

    const key = `crm-audit:${release.release}:${release.healthRuleVersion}`;
    const queued = await client.query(
      `INSERT INTO jobs (job_type, idempotency_key, payload)
       VALUES ('crm-audit', $1, jsonb_build_object('fixtureReleaseId', $2::text))
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [key, stored.id],
    );

    return { releaseId: stored.id, queued: Boolean(queued.rowCount) };
  });
}

export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  return withTransaction(async (client) => {
    const claimed = await client.query<{
      id: string;
      job_type: string;
      payload: Record<string, unknown>;
      attempts: number;
      max_attempts: number;
    }>(
      `WITH candidate AS (
         SELECT id
         FROM jobs
         WHERE status = 'queued' AND available_at <= now()
         ORDER BY available_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE jobs
       SET status = 'running',
           attempts = attempts + 1,
           locked_at = now(),
           locked_by = $1,
           started_at = COALESCE(started_at, now()),
           updated_at = now(),
           error_message = NULL
       WHERE id = (SELECT id FROM candidate)
       RETURNING id::text, job_type, payload, attempts, max_attempts`,
      [workerId],
    );

    const row = claimed.rows[0];
    return row
      ? {
          id: row.id,
          jobType: row.job_type,
          payload: row.payload,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
        }
      : null;
  });
}

export async function completeJob(jobId: string): Promise<void> {
  await pool().query(
    `UPDATE jobs
     SET status = 'succeeded', completed_at = now(), locked_at = NULL, locked_by = NULL, updated_at = now()
     WHERE id = $1 AND status = 'running'`,
    [jobId],
  );
}

export async function failJob(job: ClaimedJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const retry = job.attempts < job.maxAttempts;
  await pool().query(
    `UPDATE jobs
     SET status = $2,
         available_at = CASE WHEN $2 = 'queued' THEN now() + interval '5 seconds' ELSE available_at END,
         completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END,
         locked_at = NULL,
         locked_by = NULL,
         error_message = $3,
         updated_at = now()
     WHERE id = $1`,
    [job.id, retry ? "queued" : "failed", message.slice(0, 4000)],
  );
}

export async function loadFixture(client: PoolClient, fixtureReleaseId: string): Promise<FixtureRelease> {
  const result = await client.query<{ source: FixtureRelease }>(
    "SELECT source FROM fixture_releases WHERE id = $1",
    [fixtureReleaseId],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Fixture release ${fixtureReleaseId} does not exist.`);
  return row.source;
}

export async function persistAudit(
  fixtureReleaseId: string,
  findings: Finding[],
): Promise<string> {
  return withTransaction(async (client) => {
    const run = await client.query<{ id: string }>(
      `INSERT INTO audit_runs (fixture_release_id, status)
       VALUES ($1, 'running')
       RETURNING id::text`,
      [fixtureReleaseId],
    );
    const runId = run.rows[0]?.id;
    if (!runId) throw new Error("Audit run could not be created.");

    for (const finding of findings) {
      await client.query(
        `INSERT INTO findings
          (audit_run_id, finding_id, rule_id, rule_version, severity, object_type,
           affected_ids, evidence, proposed_remediation, automation_safety, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)`,
        [
          runId,
          finding.findingId,
          finding.ruleId,
          finding.ruleVersion,
          finding.severity,
          finding.objectType,
          JSON.stringify(finding.affectedIds),
          JSON.stringify(finding.evidence),
          finding.proposedRemediation,
          finding.automationSafety,
          finding.detectedAt,
        ],
      );
    }

    await client.query(
      `UPDATE audit_runs
       SET status = 'succeeded', finding_count = $2, completed_at = now()
       WHERE id = $1`,
      [runId, findings.length],
    );
    return runId;
  });
}

export async function latestAudit(): Promise<LatestAudit | null> {
  const run = await pool().query<{
    audit_run_id: string;
    completed_at: Date;
    source: FixtureRelease;
  }>(
    `SELECT ar.id::text AS audit_run_id, ar.completed_at, fr.source
     FROM audit_runs ar
     JOIN fixture_releases fr ON fr.id = ar.fixture_release_id
     WHERE ar.status = 'succeeded'
     ORDER BY ar.id DESC
     LIMIT 1`,
  );
  const row = run.rows[0];
  if (!row) return null;

  const findings = await pool().query<{
    finding_id: string;
    rule_id: string;
    rule_version: string;
    severity: Finding["severity"];
    object_type: Finding["objectType"];
    affected_ids: string[];
    evidence: Record<string, unknown>;
    proposed_remediation: string;
    automation_safety: Finding["automationSafety"];
    detected_at: Date;
  }>(
    `SELECT finding_id, rule_id, rule_version, severity, object_type, affected_ids, evidence,
            proposed_remediation, automation_safety, detected_at
     FROM findings
     WHERE audit_run_id = $1
     ORDER BY finding_id`,
    [row.audit_run_id],
  );

  return {
    auditRunId: row.audit_run_id,
    status: "succeeded",
    completedAt: row.completed_at.toISOString(),
    release: row.source,
    findings: findings.rows.map((finding) => ({
      findingId: finding.finding_id,
      ruleId: finding.rule_id,
      ruleVersion: finding.rule_version,
      severity: finding.severity,
      objectType: finding.object_type,
      affectedIds: finding.affected_ids,
      evidence: finding.evidence,
      proposedRemediation: finding.proposed_remediation,
      automationSafety: finding.automation_safety,
      detectedAt: finding.detected_at.toISOString(),
    })),
  };
}

export async function listJobs(): Promise<JobView[]> {
  const jobs = await pool().query<{
    id: string;
    job_type: string;
    status: JobView["status"];
    attempts: number;
    max_attempts: number;
    error_message: string | null;
    created_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT id::text, job_type, status, attempts, max_attempts, error_message, created_at, completed_at
     FROM jobs
     ORDER BY id DESC
     LIMIT 50`,
  );
  return jobs.rows.map((job) => ({
    id: job.id,
    jobType: job.job_type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    errorMessage: job.error_message,
    createdAt: job.created_at.toISOString(),
    completedAt: job.completed_at?.toISOString() ?? null,
  }));
}
