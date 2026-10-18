import { setTimeout as delay } from "node:timers/promises";
import { auditCrm } from "../../../packages/core/src/audit.ts";
import type { FixtureRelease } from "../../../packages/core/src/types.ts";
import { fixtureReleaseSchema } from "../../../packages/contracts/src/fixture.ts";
import { closePool, withTransaction } from "../../../packages/db/src/client.ts";
import {
  claimNextJob,
  completeJob,
  failJob,
  loadFixture,
  persistAudit,
} from "../../../packages/db/src/repository.ts";

const workerId = process.env.WORKER_ID ?? `anchorpoint-worker-${process.pid}`;

export async function processOneJob(): Promise<boolean> {
  const job = await claimNextJob(workerId);
  if (!job) return false;

  try {
    if (job.jobType !== "crm-audit") {
      throw new Error(`Unsupported job type: ${job.jobType}`);
    }
    const fixtureReleaseId = job.payload.fixtureReleaseId;
    if (typeof fixtureReleaseId !== "string") {
      throw new Error("crm-audit job is missing fixtureReleaseId.");
    }

    const rawRelease = await withTransaction((client) => loadFixture(client, fixtureReleaseId));
    const release = fixtureReleaseSchema.parse(rawRelease) as FixtureRelease;
    const findings = auditCrm(release);
    await persistAudit(fixtureReleaseId, findings);
    await completeJob(job.id);
    console.log(`Job ${job.id} completed with ${findings.length} findings.`);
  } catch (error) {
    await failJob(job, error);
    console.error(`Job ${job.id} failed:`, error);
  }
  return true;
}

export async function runWorker(): Promise<void> {
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    const processed = await processOneJob();
    if (!processed) await delay(2_000);
  }
}

const once = process.argv.includes("--once");
try {
  if (once) await processOneJob();
  else await runWorker();
} finally {
  await closePool();
}
