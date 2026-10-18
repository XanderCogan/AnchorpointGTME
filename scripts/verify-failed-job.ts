import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closePool, pool } from "../packages/db/src/client.ts";

const verificationJobType = "crm-audit";
const verificationKey = "verification:retry-exhaustion:v1";

interface FailureJobRow {
  status: "queued" | "failed";
  attempts: number;
  max_attempts: number;
  error_message: string | null;
}

try {
  const seeded = await pool().query<{ id: string }>(
    `INSERT INTO jobs
       (job_type, idempotency_key, payload, status, attempts, max_attempts,
        available_at, created_at, updated_at, completed_at, error_message,
        locked_at, locked_by, started_at)
     VALUES ($1, $2, '{}'::jsonb, 'queued', 0, 3, now(), now(), now(),
             NULL, NULL, NULL, NULL, NULL)
     ON CONFLICT (idempotency_key) DO UPDATE
     SET job_type = EXCLUDED.job_type,
         payload = EXCLUDED.payload,
         status = 'queued',
         attempts = 0,
         max_attempts = 3,
         available_at = now(),
         created_at = now(),
         updated_at = now(),
         completed_at = NULL,
         error_message = NULL,
         locked_at = NULL,
         locked_by = NULL,
         started_at = NULL
     RETURNING id::text`,
    [verificationJobType, verificationKey],
  );
  const jobId = seeded.rows[0]?.id;
  assert.ok(jobId, "The verification job was not created.");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const worker = spawnSync(process.execPath, ["apps/worker/src/worker.ts", "--once"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(
      worker.status,
      0,
      `Worker attempt ${attempt} exited unexpectedly:\n${worker.stderr || worker.stdout}`,
    );

    const rows: FailureJobRow[] = (await pool().query<FailureJobRow>(
      `SELECT status, attempts, max_attempts, error_message
       FROM jobs
       WHERE id = $1`,
      [jobId],
    )).rows;
    const job: FailureJobRow | undefined = rows[0];
    assert.ok(job, `Verification job ${jobId} disappeared.`);
    assert.equal(job.attempts, attempt);
    assert.equal(job.max_attempts, 3);
    assert.equal(job.error_message, "crm-audit job is missing fixtureReleaseId.");
    assert.equal(job.status, attempt < 3 ? "queued" : "failed");

    if (attempt < 3) {
      await pool().query(
        "UPDATE jobs SET available_at = now(), updated_at = now() WHERE id = $1",
        [jobId],
      );
    }
  }

  console.log(`Failure verification passed: job ${jobId} exhausted 3 attempts and is visibly failed.`);
} finally {
  await closePool();
}
