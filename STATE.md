# Project State

Last updated: 2026-10-22

This file contains only live execution context. Durable product knowledge belongs under `docs/`; use `docs/README.md` to locate it.

## Current gate

Milestone 3, the read-only Attio connection (decision 0011), was accepted on 2026-10-22. The Milestone 4 Georgia market sample runs the Milestone 4 Georgia market sample under decision 0008. Under decision 0012 (2026-10-22), Milestones 5 to 7 are also built now on labelled practice fixtures, with no email or call ever sent. Milestones 0 to 3 are complete. Their evidence is in `docs/milestones/`. The deployed Vercel and Railway preview still shows the frozen, HubSpot-shaped `inspection-v1` findings: 22 findings, 15 critical and 7 warning.

Decision 0010, approved on 2026-10-20, sets the direction:

- no fictional CRM history exists or will be generated;
- the CRM workspace holds real Georgia operators and facilities only;
- ICP hypotheses come from public evidence and labelled assumptions;
- analysis of a client's real CRM history is shown as a playbook and a pipeline tested on labelled fixtures; and
- senior living and skilled nursing is the first of about five Georgia segments, worked in depth.

Do not derive ICP hypotheses, tune score weights, or size the market from `inspection-v1`. It contains deliberate contradictions and one closed-won deal.

## Work in progress

- Georgia sample: stages 1 to 5, the account value model in code (decision 0009), the 2026-10-20 operator review decisions, and the Stage 6 Clay people pass are merged into the trunk. Tiering is rerun on the 105-operator list.

## Integration status

This is the only place that says what each integration does today. Update it in the same commit as any change.

- Attio: real Georgia operators and facilities were loaded once as Companies and Sites by `scripts/attio-load-georgia.ts`. The read-only connector syncs them into the Postgres mirror, and the Milestone 3 audit runs on that mirror.
- Clay: run once, by hand. The repo exports CSVs, Clay finds contacts, and only a coverage summary comes back (`data/georgia-sample/people-coverage.json`). Clay has no link to Attio in either direction, and no people records are in Attio.
- Planned path (decision 0012): Attio accounts go to the Clay waterfall, and contacts are written back to Attio. Then come scoring and human approval, then Lemlist (draft campaigns only) and an Attio List for TitanX (never dialed). The Clay-to-Attio writeback is not built, and writing people to Attio needs the user's approval of a target test list.
- Lemlist: no code yet (Milestone 6). The Lemlist connector is signed in to the Claude app (team "Xander Cogan's Team") and was used once, read-only, on 2026-10-22. It can also enroll, launch, and send, so every write needs the user's explicit approval.
- TitanX: no code yet (Milestone 7).
- Salesforce: connector code is superseded reference only (decision 0011).

## Blockers

- The remote branch `origin/claude/tender-tesla-9lfwvn` proposes Supabase without Railway and reuses decision numbers 0003 and 0004 for different decisions. It is not part of the plan; ignore it until the user decides whether to delete it.

## Immediate next work

Timeline, set by the user on 2026-10-20: the project is finished in one day. Prefer paying for speed over waiting for free-tier refreshes, and confirm each purchase with its price first.

Done on 2026-10-22: the Stage 6 Clay people pass. `data/georgia-sample/people-coverage.json` is written, and the results and the as-run runbook are in `docs/research/georgia-clay-people-pass.md`. Bands should be re-inspected with these inputs before they are read as final.

Flagged for later review: the two provisional senior-living personas in `docs/contracts/operating-contract.md`, once Stage 6 shows which job titles exist. Review the site administrator's low-confidence 7 person-relevance points at the same time.

1. Done on 2026-10-22: Milestone 3 accepted on the live Attio workspace; evidence in `docs/milestones/milestone-3-attio-connector-notes.md`. The local mirror needs Docker PostgreSQL (`npm run db:up`) and `.env` with the read-only token; run `npm run attio:sync`, then `npm run attio:audit`. Porting the CRM history pipeline to Attio snapshots is not started.
2. Done on 2026-10-21: coarse segment sizing in `docs/research/georgia-segment-sizing.md`. It is market context only. Senior living and skilled nursing is the one segment drilled into; no work or spend on a second segment is planned.
3. Done on 2026-10-21: the CRM analysis pipeline and the Salesforce mapping for the audit rules (superseded by 0011; the pipeline itself is CRM-neutral), verified on labelled test fixtures only (`docs/research/crm-icp-analysis-playbook.md`).
4. Milestone 4: Clay proposes a domain and primary location for the 71 eligible operators, which clears the 142 live audit findings.

## Active safety boundary

- Deployment-only credentials exist in Railway and Vercel. No live CRM credentials exist.
- No write-capable connector exists. The Attio connector allows only reads and record queries by construction, as did the superseded Salesforce connector.
- Synthetic fixtures are test inputs, never findings or market evidence.
- No email ever leaves Lemlist and TitanX never places a call (decision 0012). Human approval and deny-first suppression are still built as specified.

## Targeted handoff

In a fresh chat, read `README.md`, then this file, then at most one document routed by `docs/README.md`. Decision 0010 is the first stop for questions about what data exists and why.
