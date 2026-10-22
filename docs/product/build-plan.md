# Gated Build Plan

The project is active. Each milestone must be reviewed before the next one begins. There are two exceptions. The early Milestone 4 market work, the Georgia sample, runs alongside Milestone 3 under `../decisions/0008-parallel-data-tracks.md`. Milestones 5, 6, and 7 are built now on labelled practice fixtures under `../decisions/0012-early-activation-build-on-fixtures.md`, with nothing sent live from that data. Decision 0010 removes all fictional CRM history from the plan.

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

## Milestone 3: Read-only Attio connection

Status: in progress. Retargeted to Attio on 2026-10-21 by decision 0011. The read-only connector and audit mapping are built and verified against synthetic recorded responses; live acceptance waits for the workspace setup and token listed in `../milestones/milestone-3-attio-connector-notes.md`. The earlier Salesforce connector is superseded reference work and is not evidence for this milestone.

Connect the Attio workspace with an access token limited to read scopes. Import bounded Company, Site, People, Deal, call-log, workspace member, and Task data, preserve source timestamps, and reconcile paginated data safely. The object mapping follows `docs/decisions/0011-attio-crm-system-of-record.md`.

Under decision 0010 the workspace holds only real Georgia operators and facilities from the market sample, as Companies and Sites, loaded as a setup step separate from the read-only connector. There is no fictional history, so the other objects may be empty; synthetic recorded responses prove them.

Exit gate: repeated syncs are idempotent and no Attio records are changed.

## Milestone 4: Clay enrichment loop

Size about five Georgia segments coarsely, construct the first segment sample in depth, and derive user-reviewed ICP hypotheses from public evidence and labelled assumptions under decision 0010. Show that a client's real CRM history could be analysed with a playbook and a pipeline verified on labelled test fixtures. Then send only eligible incomplete target records to Clay. Validate returned fields, retain provenance, and distinguish unknown values from negative values.

Under decision 0008, the Georgia sample is built alongside Milestone 3. Applying ICP hypotheses to real accounts, enrichment automation, and this exit gate wait for Milestone 3 acceptance.

Deliverables:

- Coarse sizing of about five Georgia segments, documenting why senior living and skilled nursing went first
- CRM ICP analysis playbook and pipeline, verified on labelled test fixtures (`../research/crm-icp-analysis-playbook.md`)
- User-reviewed ICP hypotheses from public evidence and labelled assumptions
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

Create a controlled Attio List for approved phone-ready contacts. Connect TitanX to it, natively or through an application bridge as decision 0011 settles, and map dispositions and follow-up expectations. Use fixtures or a documented manual import if the accessible integration cannot return all required events.

Exit gate: call-ready contacts are traceable from approval through disposition without claiming unsupported API behavior.

## Milestone 8: Feedback and handoff

Build the rep work queue, service-level response-target indicators, reconciliation jobs, operating runbook, three-minute demo, and honest production-gap assessment.

Exit gate: another operator can explain the rules, investigate a failed job, stop activation, and own the system without the original builder.

