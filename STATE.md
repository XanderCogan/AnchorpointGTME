# Project State

Last updated: 2026-10-18

This file contains only live execution context. Durable product knowledge belongs under `docs/`; use `docs/README.md` to locate it.

## Current gate

Milestone 2, application foundation, is in progress. Milestone 1 was accepted on 2026-10-17 and is not awaiting another approval.

The implemented code path:

- validates and stores the immutable `inspection-v1` fixture through a PostgreSQL repository boundary;
- queues a versioned, idempotent CRM-audit job for a background worker;
- persists audit runs, findings, evidence, attempts, and visible failure state;
- exposes completed audits and job state through a bearer-protected API;
- protects the RevOps interface with a signed, HTTP-only demo session;
- presents search, severity, owner, and action-boundary filters; and
- remains entirely local, synthetic, and read-only.

The Milestone 2 interface is approved as RevOps-primary. CRO or PE-sponsor users receive oversight and readiness summaries, while sales managers and representatives become downstream users in later approval and work-queue milestones.

Strict TypeScript validation, nine tests, the inspection command, and a production Next.js build pass. PostgreSQL 17 verification now passes from migration and immutable fixture load through the queued worker, protected API, signed session, and authenticated browser. The path reproduces all 22 findings. Repeatable browser QA passes at 1440×1200 and 390×844, including critical filtering, search, detail expansion, and horizontal overflow.

A repeatable malformed `crm-audit` job exhausts all three attempts, persists its bounded error, and displays the terminal failure and `3/3` count in the authenticated desktop and narrow interfaces. The protected API returns `401` without its bearer token and `200` with it. Development services bind to loopback by default, and production configuration rejects placeholder or undersized secrets.

The local Milestone 2 exit path is accepted. The remaining deliverable is the approved Vercel and Railway preview deployment. It is blocked because this checkout has no Git remote or confirmed GitHub repository and no Vercel destination is connected. Railway is connected but requires the same confirmed repository source. No alternate host or database is approved.

## Immediate work

Complete Milestone 2 in this order:

1. Confirm the GitHub repository in `owner/name` form and add it as this checkout's remote.
2. Confirm or connect the Vercel destination; use the already connected Railway account for the backend path.
3. Create the approved Vercel web and Railway API, worker, and PostgreSQL preview services with production secrets.
4. Run the accepted foundation and browser checks against the previews, then mark Milestone 2 complete.

## Decisions needed before ICP, TAM, or enrichment work

- Confirm Anchorpoint's service catalog, branch footprint, licensing constraints, and travel-time rules.
- Select the fictional field-service, billing, or ERP source that will be reconciled with HubSpot.
- Benchmark and approve Anchorpoint's ordinary-company operating profile, including its platform age, acquired-company history, scale, and the distributions of the synthetic 24-to-36-month commercial history.
- Select the first Georgia segment sample and acceptable enrichment sources and costs.

The historical fixture must be evidence-shaped rather than convenient demo data. The external market should use real companies, facilities, and sourced public facts; Anchorpoint's internal commercial relationships and outcomes remain fictional. See `docs/research/tam-construction-plan.md` for the governing standard.

Do not derive ICP hypotheses, tune score weights, construct a production-shaped TAM, or automate Clay from `inspection-v1`. That fixture contains deliberate contradictions and only one closed-won deal.

## Active safety boundary

- No live credentials or external connectors exist.
- No write-capable connector exists.
- The first HubSpot connector must be read-only.
- Synthetic records must never be contacted or represented as real outcomes.
- Human approval and deny-first suppression remain mandatory before any future activation.

## Targeted handoff

In a fresh chat, read `README.md`, then this file. Open `docs/milestones/milestone-2-foundation-notes.md` only when resuming or verifying the application slice. The next action requires the user's confirmed GitHub repository and Vercel destination. Do not replay this chat or reopen other documents unless `docs/README.md` routes the current question there.
