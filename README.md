# Portco Launch Control

A GTM engineering work sample built for Apero Advisors. The client, Anchorpoint Fire & Safety, is a fictional private-equity-backed fire and life-safety operator. Its market is real: Georgia senior-living and skilled-nursing facilities, pulled from CMS data, resolved to operators, qualified, tiered, enriched in Clay, and loaded into Attio.

Status lives in [`STATE.md`](STATE.md). This file summarises it; if they disagree, `STATE.md` wins.

## The result

- 105 Georgia operators resolved from CMS facility records, each with its facilities, serviceability, and signals in `data/georgia-sample/`.
- 71 operators tiered: 6 in A, 15 in B, 32 in C, and 18 in Watch (`data/georgia-sample/tiers.json`). Watch is the fourth and lowest band in the scoring contract: serviceable and potentially relevant, but below the C threshold, so it stays out of the current work queue and is revisited when signals change.
- 53 operators with people coverage from a Clay role-slot pass (`data/georgia-sample/people-coverage.json`).
- Two operators traced end to end: PruittHealth, the top Tier A target with 41 facilities in footprint (CMS rows, operator resolution, tiering, Clay domain, address and six contacts across four role slots, one mobile number, live Attio writeback of the domain, address and five People with five review items), and Tift Regional, which proved the pipeline first but sits about 140 minutes from the nearest planned branch and is gated out of the tiers. Both lineage traces are in `artifacts/portfolio/`.
- The 105 operators and their facilities were loaded into Attio once as Companies and Sites, and the read-only connector mirrors them into Postgres, where the deterministic CRM audit runs.

Senior living is the only segment worked in depth. The other Georgia segments are context, not results.

## What is live and what is not

Live, as of 2026-10-22:

- Attio read-only sync, accepted as Milestone 3 against the real workspace.
- Attio writeback under the scoped write policy, run live for two operators. Tift Regional got its domain, address, and four People with two review items; PruittHealth got its domain, address, and five People with five review items. Both plan nothing on rerun.
- Clay to Attio round trip as scripts (`clay:export`, `clay:import`, dry run unless `--live`), proven on one Clay row. The remaining Clay tables were not run; about 55 free credits remain.
- Lemlist connector, enrollment ledger, kill switch, and webhook receiver, verified on practice fixtures and the real Lemlist API. No campaign has ever been launched and no email has ever been sent.
- Hosting on Vercel (web) and Render (API, worker, PostgreSQL 17). Railway was deleted after its October 2026 security incident (decision 0013).

Not built, or not finished:

- Milestone 4 stopped in progress: 142 live audit findings against the Attio load are open (Clay-proposed domains and primary locations would clear them), and the tier bands have not been re-inspected against people coverage.
- Milestone 7 (TitanX handoff) has no code. No dialer was bought (decision 0014); the design ends at an Attio List of approved phone-ready contacts.
- Milestone 8 (rep work queue, approvals table, reconciliation, runbook) is not built.
- The CRM history analysis is a method and a fixture-tested pipeline only. No fictional CRM history exists or will be generated (decision 0010).
- The deployed preview still shows the frozen `inspection-v1` audit fixture, which proves the audit engine and nothing about the market.

The gap statement in [`docs/portfolio/gap-statement.md`](docs/portfolio/gap-statement.md) covers Milestones 7 and 8 in one page.

## Constraints that shaped it

- Fictional client, real sourced market. Every external fact carries a source and retrieval date (`data/georgia-sample/source-manifest.json`).
- No fictional CRM history. Assumptions about Anchorpoint are labelled as assumptions.
- About twenty dollars of Clay spend, which is why enrichment is a single-row proof and a CSV round trip rather than a Clay-to-Attio integration.
- No autodialer purchase.
- No outreach ever: no sending domain, no mailbox, no launched campaign, no dialing. Human approval precedes any enrollment, suppression is deny-first, and a kill switch exists.
- One-segment depth over breadth, and a one-day finish once the data foundation held.

## Repository map

```text
apps/web/            Next.js findings board (sign-in currently disabled on Vercel)
apps/api/            audit and job-status API, deployed on Render
apps/worker/         PostgreSQL-backed background audit worker
packages/core/       deterministic audit types and rules
packages/contracts/  runtime source validation
packages/db/         schema, migrations, repositories, job queue
packages/connectors/ read-only Attio sync, Attio writeback, Lemlist; Salesforce kept as superseded reference
scripts/             CMS pull, operator resolution, tiering, Clay export and import, Attio load, Lemlist
data/georgia-sample/ operators, tiers, serviceability, signals, people coverage, source manifest
fixtures/            synthetic audit inputs and expected outcomes (test inputs only)
artifacts/           inspection output and the portfolio bundle
docs/                routed from docs/README.md; decisions in docs/decisions/
```

## Where to look

- [`docs/portfolio/methodology.md`](docs/portfolio/methodology.md): how the problem was approached, what was decided, and what the constraints forced, compiled from the fourteen decision records.
- [`docs/portfolio/diagrams.md`](docs/portfolio/diagrams.md): Mermaid charts of the data pipeline, the Attio object model, and the activation state machine.
- [`docs/portfolio/copy-examples.md`](docs/portfolio/copy-examples.md): two cold-email drafts for Tier A operators with the reasoning, labelled never sent.
- [`docs/portfolio/gap-statement.md`](docs/portfolio/gap-statement.md): what is designed but not built.
- [`artifacts/portfolio/`](artifacts/portfolio/): JSON copies of tiers, serviceability, people coverage, and signals, plus the Tift Regional lineage trace and an index.
- [`docs/README.md`](docs/README.md): the documentation router. Open one routed document rather than reading the set.
- [`docs/research/apero-portfolio-context.md`](docs/research/apero-portfolio-context.md): what the reader asked for and why the repo is shaped this way.

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
npm run attio:verify-recorded
npm run salesforce:verify-recorded
```

`inspection-v1` must produce 22 findings: 15 critical and 7 warning. After the foundation setup succeeds, run `npm run api` and `npm run dev` in separate terminals to open the findings board. Scripts that touch Attio, Clay, or Lemlist read their tokens from `.env` and do not load it themselves, so run them with `node --env-file=.env`. Writes are dry runs unless `--live` is passed.

## Safety boundary

The sync connector is read-only. Writeback uses a separate token scoped to records read-write and object configuration read, and only touches whitelisted attributes. Nothing enrolls, sends, or dials without a human approval that can be withdrawn, and in this project nothing ever has.
