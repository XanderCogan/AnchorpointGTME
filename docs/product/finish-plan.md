# Finish Plan

Status: active, 2026-10-22. This is the last plan. Building stops here; what remains is packaging what exists so a hiring manager and an AI assistant can read it in ten minutes.

## What is done and stays as is

- Milestones 0 to 3 and 6 are accepted. The audit engine, Attio read-only sync, Attio writeback, Clay round trip, and Lemlist connector are built and tested (88 tests).
- Milestone 4 holds 105 Georgia operators, 71 tiered (5 A, 12 B, 36 C, 18 Watch), 53 with people coverage, and one operator (Tift Regional) traced end to end from Clay into Attio.
- Milestone 5 exists as a scoring script and JSON output only. Milestones 7 and 8 are not built. They are declared designed-not-built, not finished.

## What stops now

- No more Clay runs. No Milestone 7 list. No Lemlist timing or webhook work. No CRM history port.

## Agent tasks, run in parallel, one file set each

1. README rewrite. Reconcile with STATE.md, lead with the Georgia tier results and the Tift Regional trace, state honestly what is live and what is not. File: README.md only.
2. Methodology narrative. One document in the user's voice compiling the fourteen decision records and STATE into how the problem was approached, what was decided and why, and what the constraints forced. File: docs/portfolio/methodology.md.
3. Diagrams. Three Mermaid charts with a paragraph each: the data pipeline, the Attio object model, the activation state machine. File: docs/portfolio/diagrams.md.
4. Artifact bundle. Copy tiers, serviceability, people coverage, and signals into artifacts/portfolio/, plus one lineage trace for Tift Regional from raw CMS row to Attio record, and an index. Files: artifacts/portfolio/ and scripts/build-portfolio-bundle.ts.
5. Copy and gaps. Two cold-email drafts for Tier A operators with the reasoning stated and labelled never sent, plus a one-page gap statement for Milestones 5, 7, and 8. Files: docs/portfolio/copy-examples.md and docs/portfolio/gap-statement.md.

## User-only tasks

- Record the Loom walkthroughs: the repo in three minutes, the Tift Regional trace, the tier logic.
- Read the methodology document once and fix anything that is not in your voice.
- Decide whether Watch is a tier or an undecided bucket.

## Writing rules for every agent

- No tables, no em dashes, no AI tells. Short prose and lists. Label every assumption. Never describe unbuilt work as built. Read STATE.md first and treat it as the only truth for status.
