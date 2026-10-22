# Project State

Last updated: 2026-10-22

This file contains only live execution context. Durable product knowledge belongs under `docs/`; use `docs/README.md` to locate it.

## Current gate

Milestone 3 is retargeted from Salesforce to a read-only Attio connection by decision 0011 (2026-10-21) and is in progress alongside the Milestone 4 Georgia market sample under decision 0008. Milestones 0 to 2 are complete. Their evidence is in `docs/milestones/`. The deployed Vercel and Railway preview still shows the frozen, HubSpot-shaped `inspection-v1` findings: 22 findings, 15 critical and 7 warning.

Decision 0010, approved on 2026-10-20, sets the direction:

- no fictional CRM history exists or will be generated;
- the CRM workspace holds real Georgia operators and facilities only;
- ICP hypotheses come from public evidence and labelled assumptions;
- analysis of a client's real CRM history is shown as a playbook and a pipeline tested on labelled fixtures; and
- senior living and skilled nursing is the first of about five Georgia segments, worked in depth.

Do not derive ICP hypotheses, tune score weights, or size the market from `inspection-v1`. It contains deliberate contradictions and one closed-won deal.

## Work in progress

- Milestone 3: the read-only Attio connector and audit mapping are built and verified against synthetic recorded responses. See `docs/milestones/milestone-3-attio-connector-notes.md`.
- Georgia sample: stages 1 to 5, the account value model in code (decision 0009), the 2026-10-20 operator review decisions, and the Stage 6 Clay people pass design are merged into the trunk. Tiering is rerun on the 105-operator list.

## Blockers

- Milestone 3 live acceptance needs the custom objects, attributes, and read-only access token listed in the milestone note, in the Attio workspace `10-x-media` (https://app.attio.com/10-x-media).
- The remote branch `origin/claude/tender-tesla-9lfwvn` proposes Supabase without Railway and reuses decision numbers 0003 and 0004 for different decisions. It is not part of the plan; ignore it until the user decides whether to delete it.

## Immediate next work

Timeline, set by the user on 2026-10-20: the project is finished in one day. Prefer paying for speed over waiting for free-tier refreshes, and confirm each purchase with its price first.

When Clay is connected, follow "Runbook: when Clay is connected" in `docs/research/georgia-clay-people-pass.md`. The reducer needs summary columns named exactly as listed there.

Flagged for later review: the two provisional senior-living personas in `docs/contracts/operating-contract.md`, once Stage 6 shows which job titles exist. Review the site administrator's low-confidence 7 person-relevance points at the same time.

1. Done on 2026-10-22: the read-only Attio connector and audit mapping. Porting the CRM history pipeline to Attio snapshots is not started.
2. Done on 2026-10-21: coarse segment sizing in `docs/research/georgia-segment-sizing.md`. It is market context only. Senior living and skilled nursing is the one segment drilled into; no work or spend on a second segment is planned.
3. Done on 2026-10-21: the CRM analysis pipeline and the Salesforce mapping for the audit rules (superseded by 0011; the pipeline itself is CRM-neutral), verified on labelled test fixtures only (`docs/research/crm-icp-analysis-playbook.md`).
4. When the workspace setup and token exist, finish the Milestone 3 exit-gate checks in the milestone note.

## Active safety boundary

- Deployment-only credentials exist in Railway and Vercel. No live CRM credentials exist.
- No write-capable connector exists. The Attio connector allows only reads and record queries by construction, as did the superseded Salesforce connector.
- Synthetic fixtures are test inputs, never findings or market evidence.
- Human approval and deny-first suppression remain mandatory before any future activation.

## Targeted handoff

In a fresh chat, read `README.md`, then this file, then at most one document routed by `docs/README.md`. Decision 0010 is the first stop for questions about what data exists and why.
