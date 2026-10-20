# Project State

Last updated: 2026-10-20

This file contains only live execution context. Durable product knowledge belongs under `docs/`; use `docs/README.md` to locate it.

## Current gate

Milestone 3, the read-only Salesforce connection, is in progress alongside the Milestone 4 Georgia market sample under decision 0008. Milestones 0 to 2 are complete. Their evidence is in `docs/milestones/`. The deployed Vercel and Railway preview still shows the frozen, HubSpot-shaped `inspection-v1` findings: 22 findings, 15 critical and 7 warning.

Decision 0010, approved on 2026-10-20, sets the direction:

- no fictional CRM history exists or will be generated;
- the Developer Edition org holds real Georgia operators and facilities only;
- ICP hypotheses come from public evidence and labelled assumptions;
- analysis of a client's real CRM history is shown as a playbook and a pipeline tested on labelled fixtures; and
- senior living and skilled nursing is the first of about five Georgia segments, worked in depth.

Do not derive ICP hypotheses, tune score weights, or size the market from `inspection-v1`. It contains deliberate contradictions and one closed-won deal.

## Work in progress

- Milestone 3: the read-only connector is built and verified against synthetic recorded responses on `claude/salesforce-readonly-connector-f99600`. See `docs/milestones/milestone-3-salesforce-connector-notes.md`.
- Georgia sample: stages 1 to 5 are merged. Tiering proposal 2 and the account value model in decision 0009 are approved. Parallel branches cover the value model in code (`claude/value-model-5fe132`), operator review cases (`claude/operator-review-cases-ca3273`), and the Stage 6 Clay people pass (`claude/clay-people-pass-78b8fd`).

## Blockers

- Milestone 3 live acceptance needs the user's Developer Edition org, the Site custom object, and a read-only integration user and app. The milestone note lists each step.
- Branch integration: GitHub `main` is behind. The working trunk is `docs/parallel-tracks-decisions` in the main checkout, and the branches above fork from it. Merging into `main` and pushing need the user's approval.
- The remote branch `origin/claude/tender-tesla-9lfwvn` proposes Supabase without Railway and reuses decision numbers 0003 and 0004 for different decisions. It is not part of the plan; ignore it until the user decides whether to delete it.

## Immediate next work

1. Review and merge the parallel branches into the trunk, one at a time.
2. Run the coarse segment sizing pass described in `docs/research/tam-construction-plan.md`. It does not block the nursing-home Clay pass, but it comes before any second segment or new enrichment spend.
3. Build the CRM analysis pipeline from `docs/research/crm-icp-analysis-playbook.md` on labelled test fixtures, together with the Salesforce mapping for the audit rules. It needs no org, and it comes before ICP hypotheses are drafted.
4. When the org exists, finish the Milestone 3 exit-gate checks in the milestone note.

## Active safety boundary

- Deployment-only credentials exist in Railway and Vercel. No live CRM credentials exist.
- No write-capable connector exists. The Salesforce connector is read-only by construction.
- Synthetic fixtures are test inputs, never findings or market evidence.
- Human approval and deny-first suppression remain mandatory before any future activation.

## Targeted handoff

In a fresh chat, read `README.md`, then this file, then at most one document routed by `docs/README.md`. Decision 0010 is the first stop for questions about what data exists and why.
