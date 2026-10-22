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
- Clay: run once, by hand, as a CSV round trip. Only coverage comes back (`data/georgia-sample/people-coverage.json`). It has no link to Attio, and Attio holds no people.
- Planned path (decision 0012): Attio, then the Clay waterfall, then writeback to Attio, then scoring and approval, then Lemlist (drafts only) and an Attio List for TitanX (never dialed). The writeback is not built, and writing people to Attio needs the user to approve a test list.
- Lemlist: the connector, enrollment ledger, kill switch, and webhook receiver are built and verified on practice fixtures only (Milestone 6, `docs/milestones/milestone-6-lemlist-notes.md`). The Claude app connector is signed in, and every write through it needs the user's approval.
- TitanX: no code yet (Milestone 7). Salesforce: superseded reference code only.

## Next work

1. Milestone 4: Clay proposes a domain and primary location for the 71 eligible operators, which clears the 142 live audit findings.
2. Re-inspect the tier bands with the Stage 6 people coverage before treating them as final.
3. Review the two provisional senior-living personas in `docs/contracts/operating-contract.md`, and the site administrator's low-confidence 7 person-relevance points.
4. Port the CRM history pipeline to Attio snapshots (not started).

## Blockers

- Milestone 6 live verification needs a Lemlist API key in `LEMLIST_API_KEY`.
- `origin/claude/tender-tesla-9lfwvn` proposes Supabase and reuses decision numbers 0003 and 0004. Ignore it until the user decides whether to delete it.

## Safety boundary

- The Attio connector is read-only by construction. Attio setup writes go through separate scripts and need user approval.
- Synthetic fixtures are test inputs, never findings or market evidence. Human approval and deny-first suppression are built as specified.
