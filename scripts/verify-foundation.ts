import assert from "node:assert/strict";
import { closePool } from "../packages/db/src/client.ts";
import { latestAudit, listJobs } from "../packages/db/src/repository.ts";

try {
  const audit = await latestAudit();
  assert.ok(audit, "Expected one completed audit run.");
  assert.equal(audit.release.release, "inspection-v1");
  assert.equal(audit.findings.length, 22);
  assert.equal(audit.findings.filter((finding) => finding.severity === "critical").length, 15);
  assert.equal(audit.findings.filter((finding) => finding.severity === "warning").length, 7);

  const jobs = await listJobs();
  const succeededAuditJob = jobs.find(
    (job) => job.jobType === "crm-audit" && job.status === "succeeded",
  );
  assert.ok(succeededAuditJob, "Expected one succeeded CRM-audit job.");
  assert.equal(succeededAuditJob.errorMessage, null);
  console.log("Foundation verification passed: 22 findings persisted through a succeeded job.");
} finally {
  await closePool();
}
