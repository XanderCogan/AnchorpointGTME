# Portco Launch Control

Portco Launch Control is an Apero-style GTM engineering portfolio project built around the fictional client Anchorpoint Fire & Safety. It audits HubSpot with deterministic rules, prepares bounded records for enrichment, ranks accounts and people with explainable evidence, requires human approval, routes approved contacts to Lemlist or TitanX, and returns outcomes to HubSpot and a rep work queue.

The system is intentionally gated and read-only at its current stage. No live credentials or external connectors exist.

## Portfolio audience

This project is being built as a hiring portfolio project for Apero Advisors. Its primary audience is Benyamin Holley, Apero's Head of GTM. Michael Slawson is Apero's founder and President & CEO.

Anchorpoint Fire & Safety is fictional. The project should nevertheless demonstrate the kind of market construction, CRM and revenue-systems work, outbound infrastructure, and operating handoff that Apero performs for growth private-equity-backed operators. Synthetic Anchorpoint history must be deliberately ordinary and evidence-shaped rather than optimized to make the project look unusually successful.

The intended outcome is to earn a serious conversation about working with and learning from Apero by showing practical GTM-engineering judgment, not merely by expressing interest. The durable audience, motivation, and evaluation standard are recorded in [`docs/research/apero-portfolio-context.md`](docs/research/apero-portfolio-context.md).

## Current position

- Milestone 0 is complete.
- Milestone 1 was accepted on 2026-10-17.
- Milestone 2 is complete, with the preview deployed on Vercel and Railway.
- The current application is a read-only Next.js findings board backed by the frozen `inspection-v1` fixture and the deterministic audit engine.
- The fixture proves CRM audit behavior. It is not valid evidence for ICP discovery, score calibration, or TAM sizing.
- Later Anchorpoint history must be benchmarked against real regional service-company evidence before generation. The target is a plausible, unexceptional PE-backed operator—not an idealized company or a collection of convenient demo outcomes.

Read [`STATE.md`](STATE.md) for the current gate, active decisions, and immediate next work. Use [`docs/README.md`](docs/README.md) to jump directly to the authoritative document for a specific question. Do not read the entire documentation set by default.

## Product flow

```text
HubSpot and operating-system data
  -> deterministic CRM health audit
  -> historical customer and deal analysis
  -> ICP hypotheses and external market construction
  -> bounded Clay enrichment
  -> explainable ranking and play table
  -> human approval
  -> Lemlist or TitanX
  -> outcomes in HubSpot and the rep work queue
```

## Repository shape

```text
apps/web/          authenticated Next.js read-only interface
apps/api/          protected audit and job-status API
apps/worker/       PostgreSQL-backed background audit worker
packages/core/     deterministic audit types and rules
packages/contracts/ runtime source validation
packages/db/       schema, migrations, repositories, and job queue
fixtures/          immutable synthetic inputs and expected outcomes
tests/             executable audit acceptance evidence
scripts/           repeatable inspection and artifact builders
docs/product/      scope, architecture, milestones, collaboration
docs/contracts/    approved definitions, rules, scores, and states
docs/research/     discovery, historical-data, ICP, and TAM material
docs/milestones/   implementation evidence and remaining work
docs/decisions/    durable decision records
```

Connector packages are created only when their gated milestone begins.

## Local verification

```powershell
npm install
npm run typecheck
npm test
npm run inspect
npm run build
npm run db:up
npm run foundation:setup
npm run foundation:verify
```

`inspection-v1` must produce 22 findings: 15 critical and 7 warning. After the foundation setup succeeds, run `npm run api` and `npm run dev` in separate terminals to open the authenticated read-only application. Local development uses the documented fixture-only credentials shown on the login screen; production requires all secrets in `.env.example` to be replaced.

## Safety boundary

Build one milestone at a time. Start integrations read-only. Never connect live write credentials, mutate CRM records, enroll contacts, or initiate calls before the applicable rules, preview, suppression behavior, approval gate, and audit trail have been reviewed.
