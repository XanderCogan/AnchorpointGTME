# Milestone 2 Foundation Notes

Status: in progress.

## Implemented foundation

The first application slice began as a Next.js dashboard that directly imported the frozen fixture. The current code replaces that shortcut with a PostgreSQL repository, automated SQL migration, PostgreSQL-backed job queue, background audit worker, protected HTTP API, and signed RevOps session. The interface no longer imports fixture JSON or runs the audit during rendering.

The repository boundary validates the fixture at runtime and preserves an immutable source checksum. The queue uses an idempotency key, bounded attempts, `FOR UPDATE SKIP LOCKED` claiming, retry state, and a terminal visible failure state. The worker executes the existing deterministic audit engine and persists one audit run with its findings and evidence.

The screen currently provides:

- the verified total of 22 findings;
- separate critical and warning counts;
- record and owner context;
- severity, unassigned-owner, and manual-fix filters;
- free-text search across records, owners, and rule IDs; and
- expandable evidence, remediation, rule version, and automation-safety boundaries.
- latest audit-job status and attempt counts.

All data remains fictional and local. The application performs no CRM writes, enrichment, enrollment, or calling.

## Verification

Verified without PostgreSQL:

- strict TypeScript checking across the core, contracts, database, API, worker, scripts, and web application;
- all six Milestone 1 audit tests plus three repository-boundary and presentation tests;
- a production Next.js build with dynamic authenticated application routes;
- desktop and narrow-viewport browser QA at 1440×1200 and 390×844; and
- denial of an unauthenticated audit-API request with `401`.

The in-app browser could not reach the host loopback address. A repeatable Playwright script now uses the installed local browser and stores screenshots under `artifacts/milestone-2-visual-qa/`.

PostgreSQL execution is verified through Docker Desktop 4.87.0 and PostgreSQL 17. The migration, immutable fixture load, queued worker execution, protected API, signed session, and authenticated interface reproduce the expected 22 findings. The API returns `401` without its bearer token and `200` with it.

Retry exhaustion is also repeatable. `npm run foundation:verify-failure` resets a synthetic malformed `crm-audit` job, runs the worker three times, and verifies the terminal failed state and bounded error. `npm run qa:visual:failed-job` confirms that error and the `3/3` attempt count at desktop and narrow viewports. The verification job contains no external data and does not alter the accepted fixture.

The local security review changed development listeners from all interfaces to loopback-only defaults, retained production `0.0.0.0` binding for Railway, added Railway `PORT` support, and rejects placeholder or undersized production secrets. The production Next.js build passes after these changes.

## Remaining Milestone 2 work

- Create the Vercel web preview and Railway API, worker, and PostgreSQL preview described by the approved architecture.
- Run the same migration, fixture, worker, API-authentication, signed-session, and browser checks against those preview services.

Preview deployment is blocked on source and destination setup. The checkout has no Git remote, no GitHub repository has been identified, and no Vercel destination is connected. The Railway account is connected, but Railway repository deployments also require a confirmed GitHub `owner/name` source. No alternate host or database is approved.
