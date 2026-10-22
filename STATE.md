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
- Clay to Attio automation: a script-driven CSV round trip, since the user will not pay for Clay Growth. `npm run clay:export` and `npm run clay:import` (dry run unless `--live`) are built and tested on fixtures. The export ran on 2026-10-22 and wrote 105 Companies to `data/georgia-sample/private/clay/attio/input`, and those CSVs are imported into Clay as tables `companies-1` to `companies-3`. `companies-3` has Auto-run off and these columns built but never run: `clay_domain` (Clearbit, 1 credit a row), Enrich company with `clay_address` (0.5), and Find contacts at company for all four role slots (0.5 each; limit 2 at operator level, 1 at site level). Clearbit was replaced by Clay's own Company Domain waterfall (about 0.7 credits a row). A one-row proof on 2026-10-22 (Tift Regional, row 1) returned the domain, address, and 5 people across the four slots, at about 3 credits; each person has name, title, LinkedIn, location, and employer but no email or phone. Phone lookups are paid-plan only except Clay's Mobile Phone Number function at about 10 credits a person. The CSV export shape of the people list cells is still unchecked. Still to do: the same columns on `companies-1` and `companies-2`, and making `clay:import` read `clay_address` and the per-slot people list cells instead of one person per row. About 70 free credits remain this month. The user only imports and exports one CSV in Clay. Scripts do not load `.env`, so run them with `node --env-file=.env`. Runbook in `docs/research/georgia-clay-people-pass.md`.
- Attio writeback: built and tested on fixtures. Migration 0005 is applied to the local database only. `ATTIO_WRITEBACK_TOKEN` is in `.env` (records read-write, object configuration read); suffixed attribute slugs such as `persona_verified_7` and `enrichment_date_3` are mapped through `ATTIO_WRITEBACK_SLUGS`.
- Lemlist: connector, ledger, kill switch, and webhook receiver verified on practice fixtures and the real API; webhook `hoo_6aaLNM5JX3N33S2oX` delivers to the Render API (`docs/milestones/milestone-6-lemlist-notes.md`). Feeding from Attio, with no domain or single-campaign limit and a sender-attached guard, is built.
- Dialer: none bought (decision 0014); Milestone 7 ends at the Attio List of approved phone-ready contacts, with no code yet. Salesforce: superseded reference code only.
- Hosting: Render (decision 0013) serves the API at `https://anchorpoint-api-wyaj.onrender.com`; the worker reproduced 22 findings there. Vercel production points at it with the rotated token and shows the 22 findings. Sign-in is off while Vercel has `AUTH_DISABLED=true` (delete it to restore the password). Railway is deleted.

## Next work

1. Milestone 4: Clay proposes a domain and primary location for the 71 eligible operators, which clears the 142 live audit findings.
2. Re-inspect the tier bands with the Stage 6 people coverage before treating them as final.
3. Port the CRM history pipeline to Attio snapshots (not started).
4. Later: find why live Lemlist enrollment runs took tens of seconds (a dry run takes about 2.5 seconds).
5. Later: get a real Lemlist-originated event to reach the Render webhook without sending email; only self-sent test events have been received so far.
6. Milestone 7 test, no dialer and no Clay phone credits (decision 0014): about 3 labelled practice contacts with fictional 555-01xx numbers go through scoring and approval into a real controlled Attio List; prove suppression blocks, no duplicates, withdrawn approval removes the entry, and fake dispositions write back. The writeback token may lack list-entry write scope; check on the first live call. Phone enrichment is deferred for cost (free plan excludes it; Launch required).

## Blockers

- `origin/claude/tender-tesla-9lfwvn` proposes Supabase and reuses decision numbers 0003 and 0004. Ignore it until the user decides whether to delete it.

## Safety boundary

- The Attio sync connector is read-only. Writeback uses a separate standing write token scoped to records read-write and object configuration read.
- No outreach ever: no sending domain or mailbox, no launched campaign, no dialing. Budget limits hold; confirm each purchase.
- Human approval before enrollment, deny-first suppression, the kill switch, and the review queue are built as specified. Synthetic fixtures are test inputs, never market evidence.
