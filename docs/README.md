# Documentation Router

Use this file to retrieve one precise source. Start with the narrowest matching document and expand only when that document explicitly depends on another source or when evidence conflicts.

## Live status

- Current gate, active blockers, immediate next actions, and unresolved near-term decisions: [`../STATE.md`](../STATE.md)
- One-screen project orientation, repository shape, commands, and safety summary: [`../README.md`](../README.md)

`STATE.md` is the only live status record. Milestone reports describe what was true when that work was inspected; the discovery workbook preserves dated questions and answers. Neither supersedes `STATE.md` for current status.

## Product and delivery

- User, problem, promise, workflow, scope, and top-level safety boundaries: [`product/brief.md`](product/brief.md)
- Current and planned runtime, repository boundaries, service responsibilities, and reliability requirements: [`product/architecture.md`](product/architecture.md)
- Milestone order, deliverables, and exit gates: [`product/build-plan.md`](product/build-plan.md)
- User and Codex responsibilities, decision receipts, and explain-back gates: [`product/collaboration-protocol.md`](product/collaboration-protocol.md)

## Approved behavioral contracts

- Fictional company profile, CRM definitions, readiness rules, ownership, suppression, and write policy: [`contracts/operating-contract.md`](contracts/operating-contract.md)
- Exact CRM audit rule IDs, severities, remediation, and automation-safety classifications: [`contracts/health-rule-catalog.md`](contracts/health-rule-catalog.md)
- Soft targeting, scoring inputs, evidence, confidence, and versioning: [`contracts/scoring-contract.md`](contracts/scoring-contract.md)
- Allowed play states, transitions, failures, approvals, and reversals: [`contracts/activation-state-machine.md`](contracts/activation-state-machine.md)
- Scenario inventory assigned across audit, scoring, connectors, feedback, and time boundaries: [`contracts/synthetic-scenario-manifest.md`](contracts/synthetic-scenario-manifest.md)

Treat frozen contract versions as authoritative for implemented behavior. If a proposed change conflicts with a frozen contract, record the decision first and create a new version instead of silently editing behavior.

## Research and discovery

- Portfolio purpose, Apero audience, why the Anchorpoint scenario was selected, and what the work sample must prove: [`research/apero-portfolio-context.md`](research/apero-portfolio-context.md)
- Required historical customer dataset, ICP-analysis method, Georgia-first source plan, parent-site resolution, and TAM acceptance criteria: [`research/tam-construction-plan.md`](research/tam-construction-plan.md)
- Georgia nursing-home fire-safety citations from CMS: fixable-tag mapping, repeat offenders, correction-date pattern, and publication lag: [`research/cms-fire-citations-georgia.md`](research/cms-fire-citations-georgia.md)
- Question-by-question fictional client assumptions, approval status, product consequences, and open follow-ups: [`research/anchorpoint-discovery-log.xlsx`](research/anchorpoint-discovery-log.xlsx)

Use the discovery log only when a question ID, assumption owner, answer basis, or open follow-up is needed. Use the TAM plan for the method. Do not use the CRM audit fixture as customer-history evidence.

## Milestone evidence

- Accepted Milestone 1 fixture contents, 22-finding result, contract correction, and verification evidence: [`milestones/milestone-1-inspection-report.md`](milestones/milestone-1-inspection-report.md)
- Implemented Milestone 2 slice, last verification, and remaining foundation work: [`milestones/milestone-2-foundation-notes.md`](milestones/milestone-2-foundation-notes.md)
- Milestone 3 read-only Salesforce connector, recorded-response verification, and what waits for the real org: [`milestones/milestone-3-salesforce-connector-notes.md`](milestones/milestone-3-salesforce-connector-notes.md)

Milestone reports are evidence records. Update `STATE.md`, not an old report, when only the live next step changes.

## Decisions

- Approved rationale and consequences for soft targeting and change propensity: [`decisions/0001-soft-targeting.md`](decisions/0001-soft-targeting.md)
- Approved user hierarchy for the application and Milestone 2 interface: [`decisions/0002-revops-primary-interface.md`](decisions/0002-revops-primary-interface.md)
- Approved service catalog, branch footprint, licensing gates, and travel-time rules: [`decisions/0003-service-catalog-and-footprint.md`](decisions/0003-service-catalog-and-footprint.md)
- Approved field-service source system and CRM reconciliation rules: [`decisions/0004-operating-source-system.md`](decisions/0004-operating-source-system.md)
- Approved move to Salesforce as the CRM system of record after Milestone 2: [`decisions/0005-crm-system-of-record.md`](decisions/0005-crm-system-of-record.md)
- Approved ordinary-company operating profile and historical dataset parameters: [`decisions/0006-ordinary-company-profile.md`](decisions/0006-ordinary-company-profile.md)
- Approved first Georgia segment sample, sources, enrichment budget, and personal data boundary: [`decisions/0007-first-georgia-sample-and-enrichment.md`](decisions/0007-first-georgia-sample-and-enrichment.md)
- Approved parallel tracks for the historical fixture with Milestone 3 and the Georgia market sample: [`decisions/0008-parallel-data-tracks.md`](decisions/0008-parallel-data-tracks.md)
- Approved account value model, kept separate from the priority score: [`decisions/0009-account-value-model.md`](decisions/0009-account-value-model.md)

Add a decision record when the user resolves a material ambiguity that changes product behavior, tests, contracts, or milestone scope. Do not create decision records for routine implementation details.

## Executable evidence

- Immutable synthetic source data and independently authored expected outcomes: `fixtures/releases/inspection-v1/`
- Audit implementation and shared types: `packages/core/src/`
- Runtime acceptance tests: `tests/health-audit.test.ts`
- Repeatable inspection command: `scripts/run-inspection.ts`
- Current read-only interface: `apps/web/app/`

When prose and executable evidence disagree, stop and identify the mismatch. Do not choose whichever source is more convenient.

## Filing rules

- Update one owning document for each durable fact.
- Link to that source from other documents instead of copying its full content.
- Put generated runtime output under `artifacts/`; keep immutable expected outcomes under `fixtures/`.
- Create a new fixture release instead of modifying an accepted release in place.
- Keep current state short enough to read at every handoff.
