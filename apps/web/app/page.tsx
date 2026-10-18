import { FindingsBoard } from "./findings-board";
import { logout } from "./login/actions.ts";
import { getJobs, getLatestAudit } from "../lib/api.ts";
import { requireSession } from "../lib/auth.ts";

export const dynamic = "force-dynamic";

function formatAuditTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function Home() {
  const email = await requireSession();
  const [audit, jobs] = await Promise.all([getLatestAudit(), getJobs()]);
  const latestJob = jobs[0];
  const criticalCount = audit.findings.filter((item) => item.severity === "critical").length;
  const warningCount = audit.findings.filter((item) => item.severity === "warning").length;

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">A</div>
        <div className="brand-copy">
          <span>Anchorpoint Fire &amp; Safety</span>
          <strong>Launch Control</strong>
        </div>
        <nav aria-label="Primary navigation">
          <a className="active" href="#audit">CRM audit</a>
          <span aria-disabled="true">Play table</span>
          <span aria-disabled="true">Responses</span>
        </nav>
        <div className="account-controls">
          <div className="mode-badge"><span aria-hidden="true" /> Read-only fixture</div>
          <form action={logout}>
            <button className="account-button" title={email} type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <section className="hero" id="audit">
        <div>
          <p className="eyebrow">Milestone 2 · application foundation</p>
          <h1>Fix what blocks safe growth.</h1>
          <p className="hero-copy">
            A deterministic CRM audit for Anchorpoint. Every issue below points to a source record,
            a versioned rule, and the next human action.
          </p>
        </div>
        <div className="audit-stamp">
          <span>Last verified</span>
          <strong>{formatAuditTime(audit.auditAsOf, audit.reportingTimeZone)}</strong>
          <small>{audit.release} · {audit.healthRuleVersion}</small>
        </div>
      </section>

      <section className="job-strip" aria-label="Application job status">
        <div>
          <span className={`job-state ${latestJob?.status ?? "failed"}`} />
          <strong>Audit pipeline</strong>
          <p>
            {latestJob?.status === "succeeded"
              ? `Job ${latestJob.id} succeeded and persisted audit run ${audit.auditRunId}.`
              : latestJob?.errorMessage ?? "No successful audit job is available."}
          </p>
        </div>
        <span>{latestJob?.attempts ?? 0}/{latestJob?.maxAttempts ?? 0} attempts</span>
      </section>

      <section className="metrics" aria-label="Audit summary">
        <article className="metric primary">
          <span className="metric-label">Needs attention</span>
          <strong>{audit.findings.length}</strong>
          <p>Verified record-level findings</p>
        </article>
        <article className="metric">
          <span className="metric-label critical-label">Critical blockers</span>
          <strong>{criticalCount}</strong>
          <p>Activation prohibited</p>
        </article>
        <article className="metric">
          <span className="metric-label warning-label">Warnings</span>
          <strong>{warningCount}</strong>
          <p>Human review required</p>
        </article>
        <article className="metric">
          <span className="metric-label">Source records</span>
          <strong>{audit.sourceRecordCount}</strong>
          <p>Across six CRM object sets</p>
        </article>
      </section>

      <FindingsBoard findings={audit.findings} />

      <footer>
        <p>Portfolio demonstration for Apero · Fictional data only</p>
        <p>No CRM writes, enrichment, enrollment, or calling is enabled.</p>
      </footer>
    </main>
  );
}
