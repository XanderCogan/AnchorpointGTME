# Project State

Last updated: 2026-10-22. Live context only; durable knowledge is in `docs/` (route via `docs/README.md`). Keep this file under about 40 lines.

## Current gate

- Milestones 0 to 3 are complete; evidence is in `docs/milestones/`. Milestone 3 (read-only Attio, decision 0011) was accepted on 2026-10-22.
- Milestone 4, the Georgia market sample, is in progress (decision 0008). Senior living is the only segment worked in depth. Tiers now include the people-pass inputs (2026-10-22): 6 A, 15 B, 32 C, 18 Watch.
- Milestone 5 (explainable scoring and approval gate) is complete as redefined by decision 0016. Milestone 6 (Lemlist) is built on labelled practice fixtures (decision 0012). Milestones 7 and 8 are not built. No email or call is ever sent.
- The deployed preview still shows the frozen HubSpot-shaped `inspection-v1`: 22 findings, 15 critical and 7 warning. Never use it to derive the ICP, scores, or market size.
- Timeline: the project finishes in one day. Pay for speed, and confirm each purchase with its price first.

## Integration status

- Attio: Georgia operators and facilities were loaded once as Companies and Sites. The read-only connector syncs them to the Postgres mirror, where the audit runs.
- Clay: run once so far, by hand, as a CSV round trip, keeping only coverage (`data/georgia-sample/people-coverage.json`). Attio holds nine People: four for Tift Regional and five for PruittHealth, written by the automated round trip below.
- Planned path (decision 0012, amended 2026-10-22 to run as a real company): Attio sends accounts to Clay, Clay runs the waterfall and writes contacts (with work email) back to Attio as People, then scoring and approval, then Lemlist (never launched) and an Attio List for TitanX (never dialed). Writeback is automated under the write policy, with conflicts and uncertain matches sent to review.
- Clay to Attio automation: a script-driven CSV round trip, since the user will not pay for Clay Growth. `npm run clay:export` and `npm run clay:import` (dry run unless `--live`) are built and tested on fixtures. The export ran on 2026-10-22 and wrote 105 Companies to `data/georgia-sample/private/clay/attio/input`, and those CSVs are imported into Clay as tables `companies-1` to `companies-3`. `companies-3` is the proven template, with Auto-run off: Clay's Company Domain waterfall as `clay_domain` (about 0.7 credits a row), Enrich company giving `clay_address` (0.5), Find contacts at company for the four role slots (0.5 each), free `<slot>_json` formula columns (Clay exports list cells only as "Returned N People"), and Mobile Phone Number (about 10 credits a person). Proven end to end on one row on 2026-10-22 (Tift Regional): domain, address, 5 people, and one mobile number, about 14 credits in all; `clay:import` dry run now plans 1 company update and 4 people created (one with the mobile number), with 2 persona-unverified review items; employer matching also accepts Clay's enriched company name, so rebrands such as Tift Regional to Southwell match. Phone numbers are on the writeback whitelist. Written live on 2026-10-22: Tift Regional's domain and address and 4 linked People (one with a mobile number), with 2 review items queued; a rerun plans nothing. Role map version 2 adds IT exclusions to the site administrator slot, and the persona wrongly set on a Systems Administrator was cleared; a rerun now sends that person to review. PruittHealth (band A, 41 facilities in footprint) was added as a row on `companies-3` and run the same way on 2026-10-22: domain, address, six people, one mobile number, about 13 credits; written live the same day as a domain and address update plus five People, with five review items queued (four persona unverified, one uncertain match for a retired contact); after `attio:sync` a rerun plans nothing. About 42 free credits remain this month; do not run more without the user's OK. The user only imports and exports one CSV in Clay. Scripts do not load `.env`, so run them with `node --env-file=.env`. Runbook in `docs/research/georgia-clay-people-pass.md`.
- Attio writeback: built and tested on fixtures. Migration 0005 is applied to the local database only. `ATTIO_WRITEBACK_TOKEN` is in `.env` (records read-write, object configuration read); suffixed attribute slugs such as `persona_verified_7` and `enrichment_date_3` are mapped through `ATTIO_WRITEBACK_SLUGS`.
- Lemlist: approval is campaign-level under decision 0015, with automatic enrollment from an Attio List through the native Lemlist app for Attio; the user installed the app on 2026-10-22. The planner reads approval from List membership (`lemlist:enroll --source attio --approved-list <slug>` or `ATTIO_APPROVED_LIST`), verified on fixtures only; no approved List exists in the workspace yet, so no live dry run has been made. Connector, ledger, kill switch, and webhook receiver verified on practice fixtures and the real API; webhook `hoo_6aaLNM5JX3N33S2oX` delivers to the Render API (`docs/milestones/milestone-6-lemlist-notes.md`). Feeding from Attio, with no domain or single-campaign limit and a sender-attached guard, is built. Signal-based drafting (`npm run lemlist:draft`, Claude writes one email per contact from the public fact sheet into a gitignored file that `lemlist:enroll` carries as variables only after a human fills its review fields) is built, tested, and run once on 2026-10-22 for the labelled practice contact; the draft is unreviewed and unenrolled, and nothing was sent.
- Georgia CMS pipeline: `npm run sample:georgia:refresh` chains the pull, scoring stages, Attio load, and sync; `--dry-run` passed on cached data on 2026-10-22. The monthly cron `anchorpoint-cms-refresh` runs on Render (Blueprint-synced from this branch, 06:00 UTC on the 3rd, auto-deploy off so new commits need a Manual Build). First live run 2026-10-22: all 8 stages passed in 6 minutes, 176 Serper credits, 105 Companies and 356 Sites upserted into Attio, Postgres mirror filled. Its fresh Serper results gave bands A 6, B 14, C 34, Watch 17, which now live in Attio while the committed `tiers.json` still shows the 2026-10-22 local run; the cron does not commit its outputs back. The load uses the writeback token now that the setup token is deleted (Render still names it `ATTIO_SETUP_TOKEN`; the script accepts either).
- Dialer: none bought (decision 0014); Milestone 7 ends at the Attio List of approved phone-ready contacts, with no code yet. Salesforce: superseded reference code only.
- Hosting: Render (decision 0013) serves the API at `https://anchorpoint-api-wyaj.onrender.com`; the worker reproduced 22 findings there. Vercel production points at it with the rotated token and shows the 22 findings. Sign-in is off while Vercel has `AUTH_DISABLED=true` (delete it to restore the password). Railway is deleted.

## Next work

Building has stopped under `docs/product/finish-plan.md` (2026-10-22). Remaining work is packaging only.

1. User: record the three Loom walkthroughs (video 2 script in `docs/portfolio/loom-video-2-script.md`) and read `docs/portfolio/methodology.md` once for voice.
2. Deferred, recorded in `docs/portfolio/gap-statement.md`: the remaining Clay runs, the 142 live audit findings, the CRM history port, Lemlist timing and webhook events, the Milestone 7 Attio List, and committing cron outputs back to the repo.

## Blockers

- None.

## Safety boundary

- The Attio sync connector is read-only. Writeback uses a separate standing write token scoped to records read-write and object configuration read.
- No outreach ever: no sending domain or mailbox, no launched campaign, no dialing. Budget limits hold; confirm each purchase.
- Campaign-level human approval (decision 0015), deny-first suppression, the kill switch, and the review queue are built as specified. Synthetic fixtures are test inputs, never market evidence.
