# Gap Statement: What Was Not Built

Status: written 2026-10-22 under `docs/product/finish-plan.md`. Building stopped that day. This page covers Milestones 7 and 8, the unfinished parts of Milestone 4, and what decision 0016 moved out of Milestone 5, against the gated build plan in `docs/product/build-plan.md`. Current status lives in `STATE.md`; this page records why the gaps exist and what to do first.

## 1. Why building stopped

Three reasons, in order of weight.

- The one-day timeline. The project was scoped to finish in one day (2026-10-20) and ran to 2026-10-22. The finish plan chose to package what exists rather than start work that could not be verified in the time left.
- Budget. Clay runs on free credits (about 42 remain this month, and the user will not pay for Clay Growth). No dialer was bought (decision 0014). Each paid step needs a per-purchase confirmation.
- A deliberate choice. Milestones 7 and 8 are declared designed-not-built. Their contracts, decisions, and fixtures exist; their code, tables, and screens do not.

## 2. Milestone 4: Clay enrichment loop, unfinished parts

What the plan asked for: size about five Georgia segments, build the senior-living sample in depth, derive reviewed ICP hypotheses, send only eligible incomplete records to Clay, validate returned fields with provenance, and distinguish unknown from negative values. Exit gate: trace one raw facility through parent resolution, serviceability, enrichment, and scoring inputs; enrichment cannot bypass suppression or make a record outreach-ready without recomputing eligibility.

What exists today:

- 105 Georgia operators resolved from CMS, 71 eligible and tiered (6 A, 15 B, 32 C, 18 Watch), serviceability from OSRM drive times, citation signals, and web signals, all in `data/georgia-sample/` with sources and retrieval dates.
- The Clay round trip (`npm run clay:export`, `npm run clay:import`) built and tested on fixtures, and proven live on two operators. Tift Regional's domain, address, and four linked People (one with a mobile number) were written to Attio on 2026-10-22, with two persona-unverified items in the review queue; it sits outside the footprint, so it proved the pipeline without entering the tiers. PruittHealth, band A with 41 facilities in footprint, got its domain, address, and five linked People the same day, with five review items. Those are the only operators traced end to end.
- Stage 6 people coverage for 53 operators, kept as coverage counts only in `people-coverage.json` from an earlier hand-run CSV pass. Those people are not in Attio.

What is not done:

- 70 of the 71 eligible operators are not enriched (PruittHealth is the one that is). Clay tables `companies-1` and `companies-2` still lack the proven columns from `companies-3`.
- The 142 live audit findings (`CRM-COMPANY-002` and `CRM-DATA-002`, no domain and no primary location, on each of the 71 eligible operators) are not cleared. PruittHealth's pair was filled by the live writeback, but the audit has not been re-run against the Attio load since.
- The two channel-verification points are unearned for every operator, because no email or phone verification has run. Role change and persona from `people-coverage.json` were folded into `tiers.json` on 2026-10-22; operators the people pass did not cover still score those inputs as unknown.
- The CRM history pipeline was not ported to Attio snapshots.

Exit gate status: not met. The trace exists for two operators, one of them eligible, and the suppression half is proven only by unit tests on fixtures, not by a live record moving from enrichment to eligibility.

What the next engineer does first: get the user's OK on credits, add the `companies-3` columns to `companies-1` and `companies-2`, run them with Auto-run off, import one CSV, run `clay:import` as a dry run, read the review items, then `--live`. Then re-run `npm run attio:audit` and confirm the 142 findings fall. Then rerun `tier.ts`, which now reads the people inputs, and look at which operators cross a band edge.

## 3. Milestone 5: Explainable scoring and approval gate

Redefined and closed by decision 0016 on 2026-10-22. Scoring is explainable per operator in `data/georgia-sample/tiers.json`, and the enrollment planner refuses any contact not on the approved campaign's Attio audience List. The gate is verified on fixtures; the List itself is Milestone 6's open item below.

What moved out, to Milestone 8: an `approvals` table (contact, campaign, message version, approver, timestamp, scoring version) and a read-only page listing the tiered operators with their explanations. Person-level scoring stays unearned in `tiers.json` because channel verification has not run.

## 4. Milestone 7: TitanX handoff

What the plan asked for: a controlled Attio List for approved phone-ready contacts, with dispositions and follow-up expectations mapped on fixtures. Exit gate: call-ready contacts are traceable from approval through disposition without claiming unsupported API behavior.

What exists today:

- Decision 0014: no dialer is bought; the milestone ends at the Attio List, and TitanX stays named as the system that would read it.
- The phone-ready definition in the operating contract, and the Attio writeback path that could in principle write List entries (the write policy allows controlled List entries).
- A test plan in prose only: about three labelled practice contacts with fictional 555-01xx numbers would go through scoring and approval into a real controlled Attio List, proving that suppression blocks, duplicates do not appear, withdrawn approval removes the entry, and fake dispositions write back.

What is not done: everything else. There is no code, no List in Attio, no disposition mapping, and no fixture. It is not known whether the writeback token has list-entry write scope.

Exit gate status: not met.

What the next engineer does first: make one Attio List by hand, attempt a single list-entry write with the existing writeback token to learn whether the scope is sufficient, then build the List writer on the same ledger pattern as Lemlist enrollment (plan, deny-first, idempotent, kill switch) before any disposition work.

## 5. Milestone 8: Feedback and handoff

What the plan asked for: a rep work queue, service-level response-target indicators, reconciliation jobs, an operating runbook, a three-minute demo, and an honest production-gap assessment. Exit gate: another operator can explain the rules, investigate a failed job, stop activation, and own the system without the original builder.

What exists today: nothing built for this milestone. Pieces that overlap it exist elsewhere and should not be mistaken for it.

- Runbooks for single steps: the Clay pass (`docs/research/georgia-clay-people-pass.md`), the Lemlist notes, and `README.md`. There is no operating runbook that covers running, stopping, and recovering the whole system.
- The kill switch and activation controls table from Milestone 6, which stop Lemlist enrollment but are not surfaced anywhere a rep would look.
- This page, which is the gap assessment.

What is not done: no work queue, no SLA indicators (the one-business-hour interested-reply target is defined but never measured), no reconciliation jobs between Attio and the field-service system (decision 0004 defines the rule; nothing runs it), no demo recording (the Loom walkthroughs are a user task in the finish plan and were not recorded at the time of writing).

Exit gate status: not met.

What the next engineer does first: write the operating runbook from `README.md`, `STATE.md`, and the two connector notes, and test it by asking someone else to run the audit, trip the kill switch, and read a failed job without help. Build the approvals table first, because the work queue and SLA clock both read from it.

## 6. Exit gates, in one place

- Milestone 4: not met. Two operators traced, one eligible; 70 not enriched; 142 findings open; tiers not re-inspected.
- Milestone 5: met as redefined by decision 0016. Approvals table and operator page moved to Milestone 8.
- Milestone 7: not met. No code; the Attio List does not exist.
- Milestone 8: not met. Nothing built.

Milestones 0 to 3 and 6 are accepted and are not covered here.

## Added 2026-10-22, decision 0015

The native Lemlist app for Attio is installed and the planner reads approval from membership of the campaign's audience List (the approvals file remains for offline runs). Not done: no audience List has been created in the workspace, so the List path is verified on fixtures and not against Attio.
