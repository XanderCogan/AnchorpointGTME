# Loom Video 2: One Lead End to End

Status: recording script, 2026-10-22. Facts come from `STATE.md`, `docs/research/georgia-senior-living-sample-plan.md`, and `docs/portfolio/diagrams.md`. Trace operator: PruittHealth (band A, 41 facilities in footprint) or Tift Regional (the first proven row). Pick one and stay on it.

## Opening on the diagram (about 60 seconds)

Say: this is one Georgia nursing-home operator going from a federal dataset to a CRM record with named contacts, and stopping one step before any outreach. Four tools on screen: the repo, Attio, Clay, Lemlist. Point at each and say what it owns. The repo owns sourcing, scoring, and the connectors. Attio is the system of record. Clay finds people. Lemlist is built but never launched.

Correct the two things people assume. Nothing here is scraped: the data is the public CMS nursing-home datasets, pulled through their API by a cron job on Render on the 3rd of each month, since CMS refreshes monthly. And the dashboard is a CRM health audit, not a lead board.

## Stop 1: the repo, sourcing (about 90 seconds)

Show `scripts/georgia-sample/` and the cron service in `render.yaml`. Say: these are five TypeScript scripts chained by `npm run sample:georgia:refresh`, which the Render cron runs monthly and which I can run from the command line. The first live run on Render refreshed CMS, rescored, and reloaded Attio in six minutes.

- Pull: the CMS Provider Data Catalog, four datasets, provider information, ownership, deficiencies, and the citation code lookup. Pulled 2026-10-19. 356 Georgia facilities. Not a state site; the Georgia portals forbid automation, so this sample is nursing homes only.
- Resolve: facilities to operators by CMS chain id, then controlling owner, then legal name. Ambiguous cases went to a review file I approved by hand. 105 operators.
- Serviceability: drive time from each facility to the nearest Anchorpoint branch, from OSRM, the free OpenStreetMap router.
- Signals: thirteen Life Safety Code deficiency tags mapped to the five service lines Anchorpoint sells, plus ownership changes and hiring from about 250 Serper web searches.

Show the trace operator in `data/georgia-sample/operators.json` or the lineage trace in `artifacts/portfolio/`.

## Stop 2: the repo, scoring (about 90 seconds)

Show `scripts/georgia-sample/tier.ts` and the operator's entry in `tiers.json`, with its explanation sentence.

Say why in one breath each:

- Hard gate: at least one facility in drive range for sprinkler or alarm work. 71 of 105 pass. If we cannot service them, nothing else matters.
- Change propensity: ownership or management change, hiring, a recent service-line citation, all decaying with age. An operator that just changed hands or just got cited is the one most likely to switch vendors.
- Operational need: facilities in footprint, the regulated environment, share cited since 2025, share with repeat sprinkler or alarm citations. That is the work being sold.
- Data confidence: domain match, geography, resolved versus provisional operator.
- People inputs come in two stages: accounts are scored from public data first to decide who gets enrichment credits, then role change and persona from the Clay pass are added. Channel verification has not run, so those two points are unearned.

Bands: A from 40, B from 30, C from 20, Watch below. 6 A, 15 B, 32 C, 18 Watch. Account value sits beside the score, never changes it, and orders operators within a band. Say the prices in it are labelled assumptions.

## Stop 3: Attio, the load (about 45 seconds)

Show the operator as a Company and its facilities as Sites. Say: one script, `attio-load-georgia.ts`, wrote 105 Companies and their Sites once, with tier band, tier score, and facility count on the Company. Nothing here is fictional history. No Deals, no Calls, by decision.

## Stop 4: Clay, the people pass (about 90 seconds)

Say first: this is a CSV round trip, not an API loop, because I declined to pay for Clay automation.

- `npm run clay:export` writes the companies missing a domain or address to CSV.
- Show the `companies-3` table in Clay. Columns: domain waterfall, company enrichment for the address, four role slots for contacts, mobile number. About 13 to 14 credits per operator.
- `npm run clay:import` reads the Clay export, plans the writeback, and sends conflicts, uncertain employer matches, and unverified personas to a review queue. With `--live` it writes.

Show the operator back in Attio: domain and address filled, People linked with title, work email, mobile, persona, and an enrichment stamp. Show the review items. Say: proven on two operators, Tift Regional and PruittHealth. The other 69 are a Clay budget decision, recorded in the gap statement.

## Stop 5: Postgres and the dashboard (about 30 seconds)

Say: Attio also syncs one way into a Postgres mirror on Render through a read-only connector. The CRM health audit runs there and the Vercel dashboard shows its findings. It is a data-quality check on the CRM, not a lead screen. Today it shows a frozen practice fixture.

## Stop 6: Lemlist and the stop line (about 45 seconds)

Show the connector code or the Lemlist workspace with no campaign. Say: enrollment reads Attio, checks opt-out and do-not-call, requires approval by membership of an Attio List, writes an idempotent ledger entry, and has a kill switch. A drafting step (`npm run lemlist:draft`) builds a fact sheet from the operator's cited records and has Claude write a subject, opener, and body per contact into a file that a human must mark reviewed before enrollment will carry it as Lemlist variables. It is built and tested, and one practice draft has been generated. No campaign has been launched, no mailbox or sending domain exists, and no real contact has been enrolled. The phone handoff ends at an Attio List that is not built.

## Closing (about 20 seconds)

Say: public federal data in, scored and explained operator out, named contacts written back under a review queue, and a hard stop before anyone is emailed. The gap statement lists what is left.
