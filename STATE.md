# Project State

Last updated: 2026-10-22. Live context only; durable knowledge is in `docs/` (route via `docs/README.md`). Keep this file under about 40 lines.

## Current gate

- Milestones 0 to 3 are complete; evidence is in `docs/milestones/`. Milestone 3 (read-only Attio, decision 0011) was accepted on 2026-10-22.
- Milestone 4, the Georgia market sample, is in progress (decision 0008). Senior living is the only segment worked in depth.
- Milestones 5 to 7 are built now on labelled practice fixtures (decision 0012). No email or call is ever sent.
- The deployed preview still shows the frozen HubSpot-shaped `inspection-v1`: 22 findings, 15 critical and 7 warning. Never use it to derive the ICP, scores, or market size.
- Timeline: the project finishes in one day. Pay for speed, and confirm each purchase with its price first.

## Integration status

- Attio: Georgia operators and facilities were loaded once as Companies and Sites. The read-only connector syncs them to the Postgres mirror, where the audit runs.
- Clay: run once so far, by hand, as a CSV round trip, keeping only coverage (`data/georgia-sample/people-coverage.json`). Attio holds no people yet.
- Planned path (decision 0012, amended 2026-10-22 to run as a real company): Attio sends accounts to Clay, Clay runs the waterfall and writes contacts (with work email) back to Attio as People, then scoring and approval, then Lemlist (never launched) and an Attio List for TitanX (never dialed). Writeback is automated under the write policy, with conflicts and uncertain matches sent to review.
- Clay to Attio automation: not built. The user will not pay for Clay (Growth, about $446 to $495 a month, unlocks webhooks and CRM sync). It is unconfirmed whether the free plan allows Clay's native Attio integration; the user is checking. Fallbacks: a script-driven CSV round trip, or an own-worker waterfall that replaces Clay (needs a decision record).
- Attio writeback: built and tested on fixtures on unmerged branch `refs/heads/worktree-agent-ae6da434c7a515151` (migration 0005 not applied). `ATTIO_WRITEBACK_TOKEN` is in `.env` (records read-write, object configuration read). The recreated attributes got the slugs `persona_verified_7` (checkbox) and `enrichment_date_3` (date) because Attio reserves deleted slugs; the code still expects `persona_verified` and `enrichment_date`.
- Lemlist: connector, ledger, kill switch, and webhook receiver verified on practice fixtures (`docs/milestones/milestone-6-lemlist-notes.md`). Feeding from Attio, with no domain or single-campaign limit and a sender-attached guard, is on unmerged branch `refs/heads/worktree-agent-a396da4a14abff1db`; it conflicts with this branch in decision 0012.
- TitanX: no code yet (Milestone 7). Salesforce: superseded reference code only.

## Next work

0. With the user's OK, merge the two agent branches, then point the writeback at the suffixed attribute slugs.
1. Milestone 4: Clay proposes a domain and primary location for the 71 eligible operators, which clears the 142 live audit findings.
2. Re-inspect the tier bands with the Stage 6 people coverage before treating them as final.
3. Review the two provisional senior-living personas in `docs/contracts/operating-contract.md`, and the site administrator's low-confidence 7 person-relevance points.
4. Port the CRM history pipeline to Attio snapshots (not started).

## Blockers

- Decision 0013 moves the API, worker, and database from Railway to Render. Render services are not created yet; Railway secrets must be rotated, not copied. Milestone 6 webhook registration waits on the Render API.
- `origin/claude/tender-tesla-9lfwvn` proposes Supabase and reuses decision numbers 0003 and 0004. Ignore it until the user decides whether to delete it.

## Safety boundary

- The Attio sync connector is read-only. Writeback uses a separate standing write token scoped to records read-write and object configuration read.
- No outreach ever: no sending domain or mailbox, no launched campaign, no dialing. Budget limits hold; confirm each purchase.
- Human approval before enrollment, deny-first suppression, the kill switch, and the review queue are built as specified. Synthetic fixtures are test inputs, never market evidence.
