# Gated Build Plan

The project is active. Each milestone must be reviewed before the next one begins. The one exception is the early Milestone 4 data work, which runs alongside Milestone 3 in two tracks under `../decisions/0008-parallel-data-tracks.md`.

## Milestone 0: Operating contract

Status: complete. `operating-contract-v1.2` is the current approved version.

Decide the fictional company, ICP, lifecycle definitions, ownership expectations, stale-record thresholds, required fields, scoring inputs, suppression rules, and which proposed fixes are eligible for automation.

Deliverables:

- Approved field and metric definitions
- Versioned health-rule catalog
- Versioned account-scoring contract
- Activation and suppression state machine
- Synthetic scenario manifest

## Milestone 1: Synthetic HubSpot audit

Status: accepted on 2026-10-17 after strict type-checking, six runtime tests, and the 22-finding inspection all passed. The first fixture release covers every frozen non-connector CRM-audit rule; later scenario families remain gated.

Create deterministic HubSpot fixtures and a local rule engine. Produce record-level findings with evidence before building the polished dashboard.

Deliverables:

- Synthetic companies, contacts, deals, owners, associations, and activities
- Independent expected outcomes
- Health-rule implementation
- Unit tests for normal and adversarial cases
- Read-only inspection report

Exit gate: every seeded problem is detected once, healthy records remain healthy, and results are explainable without reading code.

## Milestone 2: Application foundation

Status: complete. The reproducible local foundation passes the exit gate against PostgreSQL and displays the frozen fixture's verified findings through the worker, protected API, authenticated interface, and visible retry-exhaustion state. The Vercel and Railway preview is deployed and reproduces the same 22 findings.

Create the monorepo, database schema, API, worker, job queue, and minimal dashboard. Deploy the web application to Vercel and the backend services and PostgreSQL to Railway.

Deliverables:

- Reproducible local setup
- Automated migrations
- Authentication boundary
- Job status and failure visibility
- Preview deployment

Exit gate: a clean environment can load the fixtures, run the audit, and display the same expected findings.

## Milestone 3: Read-only Salesforce connection

Connect a Salesforce Developer Edition org holding only synthetic data, using read-only permissions. Import bounded Account, Site, Contact, Lead, Opportunity, User, Task, and Campaign data, preserve source timestamps, and reconcile paginated data safely. The object mapping follows `docs/decisions/0005-crm-system-of-record.md`.

The org's synthetic data is the first historical fixture release from decision 0006, loaded as a setup step separate from the read-only connector. Under decision 0008, this milestone is Track A and runs alongside the Georgia market sample.

Exit gate: repeated syncs are idempotent and no Salesforce records are changed.

## Milestone 4: Clay enrichment loop

Before automating enrichment, create and inspect the historical customer dataset described in `../research/tam-construction-plan.md`, derive user-reviewed ICP hypotheses, and construct a bounded Georgia-first market sample. Then send only eligible incomplete target records to Clay. Validate returned fields, retain provenance, and distinguish unknown values from negative values.

Under decision 0008, the historical dataset and the Georgia sample are built before or alongside Milestone 3. Applying ICP hypotheses to real accounts, enrichment automation, and this exit gate wait for Milestone 3 acceptance.

Deliverables:

- Historical won-and-lost discovery dataset joined to fictional operating truth
- User-reviewed ICP hypotheses
- Bounded external market sample with parent and site resolution
- Serviceability evidence
- Progressive enrichment workflow with cost and freshness controls

Exit gate: the user can trace one raw facility through parent resolution, serviceability, enrichment, and scoring inputs; enrichment cannot bypass suppression rules or make a record outreach-ready without recomputing eligibility.

## Milestone 5: Play table and approval

Implement explainable scoring, account tiers, contact recommendations, message inputs, approval decisions, and before-action previews.

Exit gate: a manager can understand why every account was included, excluded, or blocked.

## Milestone 6: Lemlist activation

Add dry-run enrollment, explicit approval, idempotent creation, webhook ingestion, unsubscribe handling, and a kill switch for future steps.

Exit gate: fixtures prove that duplicate delivery, retries, and suppression conflicts cannot produce duplicate or prohibited enrollment.

## Milestone 7: TitanX handoff

Create a controlled Salesforce Campaign for approved phone-ready contacts. Configure the supported TitanX Salesforce integration, confirmed under decision 0005, and map dispositions and follow-up expectations. Use fixtures or a documented manual import if the accessible integration cannot return all required events.

Exit gate: call-ready contacts are traceable from approval through disposition without claiming unsupported API behavior.

## Milestone 8: Feedback and handoff

Build the rep work queue, service-level response-target indicators, reconciliation jobs, operating runbook, three-minute demo, and honest production-gap assessment.

Exit gate: another operator can explain the rules, investigate a failed job, stop activation, and own the system without the original builder.

