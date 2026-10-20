# Project State

Last updated: 2026-10-20

This file contains only live execution context. Durable product knowledge belongs under `docs/`; use `docs/README.md` to locate it.

## Current gate

Milestone 2, application foundation, is complete. Milestone 1 was accepted on 2026-10-17 and is not awaiting another approval.

The implemented code path:

- validates and stores the immutable `inspection-v1` fixture through a PostgreSQL repository boundary;
- queues a versioned, idempotent CRM-audit job for a background worker;
- persists audit runs, findings, evidence, attempts, and visible failure state;
- exposes completed audits and job state through a bearer-protected API;
- protects the RevOps interface with a signed, HTTP-only demo session;
- presents search, severity, owner, and action-boundary filters; and
- uses only synthetic data and remains read-only.

The Milestone 2 interface is approved as RevOps-primary. CRO or PE-sponsor users receive oversight and readiness summaries, while sales managers and representatives become downstream users in later approval and work-queue milestones.

Strict TypeScript validation, nine tests, the inspection command, and a production Next.js build pass. PostgreSQL 17 verification now passes from migration and immutable fixture load through the queued worker, protected API, signed session, and authenticated browser. The path reproduces all 22 findings. Repeatable browser QA passes at 1440×1200 and 390×844, including critical filtering, search, detail expansion, and horizontal overflow.

A repeatable malformed `crm-audit` job exhausts all three attempts, persists its bounded error, and displays the terminal failure and `3/3` count in the authenticated desktop and narrow interfaces. The protected API returns `401` without its bearer token and `200` with it. Development services bind to loopback by default, and production configuration rejects placeholder or undersized secrets.

The local Milestone 2 exit path is accepted. The source, Railway API and worker configuration, Vercel configuration, production port handling, and concurrency-safe migrations are committed and pushed to `XanderCogan/AnchorpointGTME` on `main`.

The complete Vercel and Railway preview is deployed. The Railway `Anchorpoint` project is online with current `SUCCESS` deployments for Postgres, API, and Worker and no staged work. Its first run failed because `POSTGRES_PASSWORD` was absent: Postgres repeatedly rejected initialization and the API and worker migrations timed out. A generated non-empty password was added, then Postgres, API, and Worker were redeployed in dependency order. PostgreSQL 17.11 is accepting connections on port 5432, migrations applied, `inspection-v1` loaded, and worker job 1 completed with 22 findings. The superseded API and worker failures remain visible only in recent deployment history.

Vercel serves the production interface at `https://anchorpoint-gtme.vercel.app`, backed by the Railway API at `https://api-production-0e83a.up.railway.app`. Fresh deployment secrets were installed after rotation, the matching internal API token was deployed to both platforms, and Vercel deployment `UmvNiSvxzQ1fqGseK9XR1UZVokW1` is ready. Live checks passed: `/health` returned `{"status":"ok"}`, an unauthenticated `/v1/audits/latest` request returned `{"error":"unauthorized"}`, the signed demo login succeeded, and the authenticated desktop and 390×844 interfaces showed job 1, 22 findings, 15 criticals, and 7 warnings. The previously existing `pong-hack-sundai140-lock` Railway project remains unrelated and untouched. No alternate host or database was used.

## Immediate work

Timeline, set by the user on 2026-10-20: the project is finished in one day. Prefer paying for speed over waiting for free-tier refreshes, and confirm each purchase with its price first.

Flagged for later review: the two provisional senior-living personas in `docs/contracts/operating-contract.md`, once Stage 6 shows which job titles exist.

Milestone 2 has no remaining implementation or preview blocker. All four decisions required before ICP, TAM, or enrichment work were approved on 2026-10-19. Decision 0008 originally ran the next work as two parallel tracks. On 2026-10-20 the user cancelled Track A, the synthetic historical fixture, because a real-data TAM is the portfolio's centerpiece; its branch was deleted unmerged. Track B, the first Georgia market sample under decision 0007, is the active work. Each decision's open items are settled when that work reaches them. On 2026-10-20 the user approved tiering proposal 2 and the account value model in `docs/decisions/0009-account-value-model.md`. Parallel work now covers the value model in code, the operator review cases, the Stage 6 Clay table design, and Milestone 3 groundwork for the read-only Salesforce connector.

## Decisions resolved before ICP, TAM, or enrichment work

- Resolved: service catalog, branch footprint, licensing constraints, and travel-time rules are approved in `docs/decisions/0003-service-catalog-and-footprint.md`.
- Resolved: Salesforce is the CRM system of record for post-Milestone 2 work under `docs/decisions/0005-crm-system-of-record.md`. `inspection-v1` and the deployed Milestone 2 application stay HubSpot-shaped.
- Resolved: the field-service source system and CRM reconciliation rules are approved in `docs/decisions/0004-operating-source-system.md`.
- Resolved: the ordinary-company operating profile and historical dataset parameters are approved in `docs/decisions/0006-ordinary-company-profile.md`.
- Resolved: the first Georgia sample covers senior living and skilled nursing, with sources, an enrichment budget of $20 for Clay and $20 for one other service (set on 2026-10-20, with Clay allowed to exceed $20 for the one-day timeline), and a personal data boundary approved in `docs/decisions/0007-first-georgia-sample-and-enrichment.md`.

The historical fixture must be evidence-shaped rather than convenient demo data. The external market should use real companies, facilities, and sourced public facts; Anchorpoint's internal commercial relationships and outcomes remain fictional. See `docs/research/tam-construction-plan.md` for the governing standard.

Do not derive ICP hypotheses, tune score weights, construct a production-shaped TAM, or automate Clay from `inspection-v1`. That fixture contains deliberate contradictions and only one closed-won deal.

## Active safety boundary

- Deployment-only credentials exist in Railway and Vercel; no live CRM credentials or external business-system connectors exist.
- No write-capable connector exists.
- The first Salesforce connector must be read-only.
- Synthetic records must never be contacted or represented as real outcomes.
- Human approval and deny-first suppression remain mandatory before any future activation.

## Targeted handoff

In a fresh chat, read `README.md`, then this file. Open `docs/milestones/milestone-2-foundation-notes.md` only when verifying the completed application slice. The next work is product discovery governed by the decisions above, not additional Milestone 2 deployment work. Do not replay this chat or reopen other documents unless `docs/README.md` routes the current question there.
