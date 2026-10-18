# Milestone 1 Inspection Report

Status: accepted on 2026-10-17 after a clean verification rerun.

Fixture release: `inspection-v1`  
Rule version: `health-rules-v1`  
Operating contract: `operating-contract-v1.2`  
Audit timestamp: 2026-10-17 4:00 p.m. America/New_York

## What was built

Milestone 1 created a deterministic, read-only CRM audit without a database, dashboard, external API, or write credential. The implementation accepts a frozen HubSpot-shaped JSON release and returns versioned findings with stable IDs, severity, affected records, evidence, remediation, automation-safety classification, and detection time.

The release contains:

- 3 owners
- 8 companies
- 16 contacts
- 8 deals
- 11 activities
- 2 tasks

All companies, people, events, phone numbers, and `.example` domains are fictional.

## Actual findings

The audit produced 22 findings, matching the independently authored expected results exactly:

- 15 critical findings
- 7 warning findings
- 0 informational findings

The critical findings cover duplicate identity, missing associations, missing ownership, customer and open-opportunity suppression, unsubscribe and do-not-call conflicts, missing persona and geography, invalid email, and missing phone.

The warnings cover a missing call disposition, missing location count, a stale contact, a stale deal, two deals without next steps, and a contradictory lifecycle state.

All 21 frozen non-connector rules have at least one seeded finding. `CRM-DEAL-003` intentionally produces two findings because two different deals lack a next step and future task.

## Boundary controls

The release proves three important non-findings:

- `deal-006` has activity exactly 14 days before the audit and remains fresh because the rule is strictly older than 14 days.
- `deal-007` has old activity but a valid future owner-assigned task and is not marked stale.
- `contact-015` has activity and enrichment exactly 90 days before the audit and remains fresh.

These controls guard against off-by-one errors and a false stale classification.

## Contract correction discovered during inspection

The first run allowed any recent activity associated with a company to reset every open deal at that company. A recent call on `deal-008` therefore hid the intentionally stale `deal-005`.

That behavior was incorrect for a company with multiple commercial motions. The operating contract was clarified from version 1 to version 1.1: only material activity associated directly with a deal resets that deal's staleness clock. The implementation was corrected, and the frozen expected findings then passed.

This is the main reason fixtures preceded the dashboard. A polished aggregate could have hidden this semantic error.

After the inspection, version 1.2 added a targeting clarification: safety and serviceability remain hard gates, while ICP characteristics are soft prioritization signals. `account-score-v1.1` now weights observable propensity to drive change more heavily than rigid firmographic cutoffs. Scoring remains unimplemented and assigned to its later gate.

## Verification evidence

`npm run typecheck` passes under strict TypeScript settings with unchecked indexed access enabled.

`npm test` passes six tests covering:

- Exact finding equality
- Independent source and severity control totals
- Finding evidence and stable identity
- Coverage of every frozen non-connector rule
- Time boundaries and future-task behavior
- Determinism and input immutability

`npm run inspect` recreates `artifacts/inspection-v1/findings.json` and reports 22 findings with the expected severity counts.

## Deliberately deferred

- Account scoring
- Activation-state transitions
- Cross-system connector rules
- HubSpot API access
- Clay enrichment
- Lemlist enrollment and webhooks
- TitanX handoff
- Database schema and queue
- Dashboard

Those remain assigned to later gates. This inspection was accepted on 2026-10-17, which opened Milestone 2.

