# CRM ICP Analysis Playbook

Status: method, approved under decision 0010 on 2026-10-20. It has not been run on real data, because Anchorpoint has no real CRM history. This is what the project would run on a client's Salesforce.

## Purpose

Find which kinds of accounts a client wins, pays the most, and keeps, then turn that into soft ICP hypotheses for the TAM. The machine does most of the hours. The human does most of the judgment, because only a human can tell which records are wrong and which patterns are worth betting on.

## Inputs

- The read-only Salesforce mirror from Milestone 3: Accounts, Sites, Contacts, Opportunities, Users, Tasks, and Campaigns with their source timestamps.
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

Built: the read-only Salesforce connector and mirror, and the Milestone 1 audit rules in their HubSpot shape. To build in Milestone 4: the Salesforce mapping for the audit rules, the market join, and the outcome cuts as queries over the mirror, verified on labelled test fixtures. Their outputs on fixtures prove the queries run and are never presented as findings.
