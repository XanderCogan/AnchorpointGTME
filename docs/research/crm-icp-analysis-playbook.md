# CRM ICP Analysis Playbook

Status: method, approved under decision 0010 on 2026-10-20. It has not been run on real data, because Anchorpoint has no real CRM history. This is what the project would run on a client's CRM.

## Purpose

Find which kinds of accounts a client wins, pays the most, and keeps, then turn that into soft ICP hypotheses for the TAM. The machine does most of the hours. The human does most of the judgment, because only a human can tell which records are wrong and which patterns are worth betting on.

## Inputs

- The read-only CRM mirror from Milestone 3 (Attio under decision 0011; the mirror built so far is Salesforce-shaped): Accounts, Sites, Contacts, Opportunities, Users, Tasks, and Campaigns with their source timestamps.
- The client's billing or field-service records, which decision 0004 treats as the truth for revenue and service.
- The public market tables from the TAM pipeline: facility type, beds or size, ownership, citations, drive time, and hiring signals.

Use 24 to 36 months of history. Less hides seasonality and churn. More mixes in a company that no longer exists.

## Steps

1. **Pull and freeze.** Run a bounded sync, record its window and checksum, and analyse that snapshot only.
2. **Audit before trusting.** Run the health rules (owners, duplicates, stale opportunities, contradictions) through the Salesforce mapping. Each finding either excludes a record from the analysis or is corrected with the client's sign-off. Never silently.
3. **Reconcile with billing.** A won deal that was never invoiced is not a win. A customer that stopped paying is churned, whatever the CRM says. Amounts come from invoices, not opportunity estimates.
4. **Resolve parents and sites.** Roll sites up to operating parents so one chain is not counted as twelve customers.
5. **Join the market data.** Attach public traits to each account using the same identity resolution as the TAM, and record match confidence.
6. **Cut the outcomes.** For each trait, compare win rate, first-year value, sales-cycle length, retention, and expansion: chain size, facility type, citations before the deal, distance to branch, lead source, and buying role.
7. **Respect sample size.** Report counts next to every rate. A pattern built on fewer than about 10 outcomes is a question to ask, not a finding. Prefer "multi-site operators renewed more often, 14 of 16 against 9 of 15" over a percentage alone.
8. **Ask the people.** Take the strongest and the strangest patterns to two or three sales reps and, where possible, customers. The numbers show what happened; the interviews explain why, and the why decides whether a pattern is worth acting on.
9. **Write soft hypotheses.** Each hypothesis is a plain statement with examples, counts, and a confidence. It adjusts priority under decision 0001 and never becomes a hard cutoff.
10. **Apply and version.** Feed the hypotheses into the scoring contract as a new version, then rescore the TAM.

## Why CRM records are wrong

Mostly not malice. Incentives and habit:

- deals marked won at quarter-end to hit quota, then quietly reworked;
- lost reasons left at the first dropdown option;
- opportunities nobody closed, sitting open for a year;
- duplicate accounts from imports and acquisitions;
- customer flags never cleared after churn; and
- amounts entered as hopes and never updated to the invoiced value.

Steps 2 and 3 exist for these.

## Who does what

The machine: syncing, deduplication, reconciliation joins, enrichment, every cut, flagging thin samples and outliers, and drafting hypotheses with the case against each.

The human: choosing the questions, deciding which records to distrust, knowing the context behind odd wins and losses, running the interviews, and deciding what the client bets on.

## Status in this project

Built: the read-only Salesforce connector and mirror (Milestone 3), the Milestone 1 audit rules with a Salesforce mapping, and the pipeline for steps 1 to 7 and the machine half of step 9. Steps 8, the judgment in 9, and 10 are human work and wait for a client's real history. Every run in this project uses labelled synthetic test fixtures; the outputs prove the code runs and are never findings (decision 0010).

### Salesforce mapping for the audit rules

Built under decision 0005 and superseded by decision 0011. `packages/core/src/attio-mapping.ts` replaces it for the audit rules (see `../milestones/milestone-3-attio-connector-notes.md`). The history pipeline below still reads Salesforce-shaped snapshots.

`packages/core/src/salesforce-mapping.ts` turns a mirror snapshot into the CRM-neutral audit model, so `auditCrm` runs unchanged.

- Accounts become companies. `Account.Type` sets customer status from configured lists, `BillingState` inside the serviced states sets geography (a missing state is unknown), `Website` is the domain, and the location count is the number of Sites on the Account (none recorded is unknown). Sites never become companies.
- Opportunities become deals. `IsClosed` and `IsWon` set the closed stages, `StageName` maps open stages, `Type` maps to a pipeline, and `NextStep` is the next step.
- Users become owners. An owner who is inactive, unknown, or listed as an integration or queue user counts as no owner.
- Completed Tasks become activities (call, email, or other), with `CallDisposition` as the required call outcome. Open Tasks become tasks due on `ActivityDate`.
- `HasOptedOutOfEmail` and `DoNotCall` carry suppression. Target candidacy, persona, email and phone verification, enrichment date, and lifecycle stage have no standard field and come from configurable custom fields, by default `Target_Candidate__c`, `Persona__c`, `Email_Status__c`, `Phone_Status__c`, `Enrichment_Verified_At__c`, and `Lifecycle_Stage__c`. They join the connector's field list only once the org has them. A mapped field missing from the payloads is reported as a gap and falls back to the blocking default: unverified, not a target, no owner.
- The connector now also reads the standard fields `Opportunity.NextStep`, `Opportunity.LeadSource`, `Task.CallDisposition`, and `Task.CompletedDateTime`.

Not mapped yet: deleted records (nothing in a snapshot is archived), Leads, Events, Campaign Members, and Opportunity Contact Roles, so buying role cannot be cut.

### Analysis pipeline

`packages/core/src/crm-history.ts` runs over a frozen snapshot plus billing and market inputs. `loadSalesforceSnapshot` in `packages/db/src/salesforce-mirror.ts` reads one connection's mirror as that snapshot.

1. Freeze: records the sync window and a SHA-256 checksum that ignores record order and API version, and warns outside 24 to 36 months.
2. Audit: runs the mapped rules and keeps the analysis-relevant ones: duplicate accounts, orphan contacts and opportunities, missing owners, stale opportunities, and lifecycle contradictions. Each needs a human disposition: exclude, merge into a named survivor, or accept. A finding without one blocks the run and withholds every cut and hypothesis.
3. Reconcile: a won opportunity with no invoice on its operator within 90 days of close is held out and listed, not counted. Value is first-year invoiced revenue. An operator with no invoice for 120 days has churned, and customer flags on churned operators are listed.
4. Parents: walks `ParentId` to the top, cycle-safe, applies approved merges, and rolls Sites up to the parent as chain size.
5. Market join: normalized domain first, then normalized name and state, recording which matched; unmatched parents are counted.
6. Cuts: win rate, first-year value, median sales cycle, retention, and expansion by chain size, facility type, citations before the deal, drive time, lead source, and buying role.
7. Sample size: every rate carries its numerator and denominator and is flagged thin below 10.
8. Drafts: a bucket at least 15 points above the known rest becomes a draft hypothesis with counts, a low or medium confidence (never high), and the case against it. A thin gap becomes a question for sales. Synthetic snapshots are labelled test output, not findings.

### Verification on 2026-10-21

- `fixtures/releases/salesforce-mapping-v1/` is a Salesforce-shaped synthetic fixture that reproduces all 20 `inspection-v1` rules through the mapping, as decision 0005 requires: 21 findings, 15 critical and 6 warning, matching independently authored expectations with no mapping gaps.
- `fixtures/analysis/crm-history-test-v1/` is a synthetic history of 27 accounts, 50 sites, 26 opportunities, 296 invoices, and 23 market rows, with planted problems: an import duplicate, a regional child account, a quarter-end win never invoiced, two churned operators still flagged Customer, an untouched open opportunity, and unmatched market rows. Its control totals were written from the fixture's design.
- `npm test` passes 43 tests, 11 of them new in `tests/salesforce-audit-mapping.test.ts` and `tests/crm-history.test.ts`. `npm run -s typecheck` passes, and `npm run -s inspect` still gives 22 findings, 15 critical and 7 warning.
- `npm run salesforce:verify-recorded`, which now also reads the mirror back as a snapshot with a stable checksum, passed twice against a scratch PostgreSQL 17 database that was then dropped.
- `node scripts/run-crm-history-test.ts` prints the full pipeline output on the test fixture.
