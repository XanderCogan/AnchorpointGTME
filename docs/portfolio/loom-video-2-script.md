# Loom Video 2: One Lead End to End

Status: recording script, revised 2026-10-22 from the user's first take. Facts come from `STATE.md`, `docs/research/georgia-senior-living-sample-plan.md`, `docs/research/cms-fire-citations-georgia.md`, and `docs/portfolio/diagrams.md`. Trace operator: PruittHealth (band A, 63 Georgia facilities, 41 in footprint) or Tift Regional (the first proven row). Pick one and stay on it. Attio and Lemlist get one sentence each; the two things to show off are the dashboard and the drafted email.

## Corrections to the first take

Keep these out of the recording.

- Nothing is scraped. The source is the CMS Provider Data Catalog API, four public datasets, pulled by a cron on Render on the 3rd of each month. Say "pulled", not "scraped".
- There is one source list, not two. The "second list" is the CMS ownership dataset, which is how facilities get matched to operators.
- The enforcement story is softer than the first take. Facilities commit to fixing Life Safety citations within about six weeks. The 3-month payment denial and 6-month termination thresholds are in federal rules but are effectively never reached for these tags in Georgia (9 of 1,224 corrections were due more than 90 days out, none more than 180). Do not say "fines are horrific" or "they stop getting Medicaid at 3 months" as fact. The fire-watch claim is not in the research; drop it. The real pressure point is that 45 percent of Georgia facilities were cited for the same fixable tag at two or more inspections, so the problem keeps coming back on the public record.
- Use a real tag. K0353, sprinkler inspection, testing, and maintenance, is the most cited tag in Georgia at 454 citations. Not an invented code.
- The flow is repo to Attio, then a CSV round trip to Clay and back to Attio. Attio does not push to Clay automatically; that automation was declined on cost.
- Postgres is a read-only mirror of Attio on Render, not a backup. The CRM health audit runs on that mirror and the Vercel dashboard shows the audit's findings. It is a CRM data-quality audit, not pipeline health, and today it shows a frozen practice fixture of 22 findings, not Georgia data.
- Lemlist does not draft the email. A repo script has Claude draft it from the operator's cited records, into a file a human must review. The draft never reaches Lemlist until a human marks it reviewed and enrollment runs, which has not happened. Show the draft file, not Lemlist.
- The dialer is TitanX, not "Tightnext". It is not integrated and no dialer was bought.
- Four Anchorpoint branches, placed at city centers, labelled as an assumption.

## Opening on the diagram (about 45 seconds)

Say: this is one Georgia nursing-home operator going from a federal dataset to a scored CRM record with named contacts and a drafted email, stopping one step before anyone is contacted. Point at the four boxes: the repo owns sourcing, scoring, and connectors; Attio is the system of record; Clay finds people; Lemlist is built but never launched. Mention that this ran on Railway until this morning's security incident and now runs on Render.

## Stop 1: the federal data (about 75 seconds)

Show the CMS Provider Data Catalog page for one of the datasets, then `scripts/georgia-sample/pull-cms.ts`.

Say: nursing homes are federally regulated, and CMS publishes every Life Safety Code deficiency with its K-tag. K0353 is sprinkler inspection, testing, and maintenance, the most cited tag in Georgia. The alarm tags, extinguishers, kitchen suppression, and emergency lighting each have their own tag, and thirteen of them map to the five service lines Anchorpoint sells. Because the record goes back years, we can see which buildings are cited for the same thing inspection after inspection. Nearly half of Georgia facilities have at least one repeat. That is the signal: a sprinkler system that keeps failing inspection is a facility manager who is open to a different vendor.

Four datasets, pulled monthly by a Render cron: provider information, ownership, deficiencies, and the tag lookup. 356 Georgia facilities. The first live cron run refreshed everything and reloaded Attio in six minutes.

## Stop 2: facilities to operators (about 75 seconds)

Show `scripts/georgia-sample/resolve-operators.ts` and `data/georgia-sample/review-decisions.json`.

Say: a facility is not a customer; the operator that runs it is. CMS gives three ways to find the operator, and the resolver tries them in order.

- First, the CMS chain id on the provider record. 28 chains cover 248 of the 356 facilities.
- Second, the ownership dataset: an organization listed with operational or managerial control, corroborated by an ownership interest.
- Third, the legal business name, which groups the standalones.
- Anything ambiguous goes to a review file instead of being merged. I approved 34 facility merges and 2 chain decisions by hand, each with its evidence: operator websites, the NPI registry, news, search results. That is how three PruittHealth-branded buildings with no legal name on file joined PruittHealth.

Result: 105 operators, 103 resolved, 2 provisional, 5 review cases still open. One rule worth saying out loud: individual owners' names never enter the output, and the resolver fails the run if one does. Five chains are registered under a person's name, so they are grouped by id and withheld until a publishable organization name is found.

## Stop 3: serviceability and scoring (about 75 seconds)

Show `scripts/georgia-sample/serviceability.ts`, then the operator in `tiers.json` with its explanation sentence.

Say: a van has to drive there. Drive time from every facility to the nearest capable branch comes from OSRM, the free OpenStreetMap router, four requests for the whole state. The four branches are assumptions placed at city centers. The hard gate is at least one facility in drive range for sprinkler or alarm work; 71 of 105 operators pass.

Then the score, one breath each: change propensity (ownership change, hiring, recent service-line citation, decaying with age), operational need (facilities in footprint, share cited since 2025, share with repeat sprinkler or alarm citations), data confidence (domain, geography, resolved versus provisional), and people inputs from the Clay pass. Bands A from 40, B from 30, C from 20, Watch below: 6 A, 15 B, 32 C, 18 Watch. Account value sits beside the score with labelled price assumptions and never changes it.

## Stop 4: Attio and Clay in one breath (about 30 seconds)

Show the operator as a Company in Attio with its Sites and linked People. Say: one script writes the operators and facilities into Attio with band and score. Clay then finds the facility-side people, the ones responsible for life safety, through a CSV round trip that writes title, work email, mobile, and persona back to Attio, with uncertain matches sent to a review queue. Proven on two operators; the rest is a credit budget decision in the gap statement.

## Stop 5: the dashboard (about 60 seconds)

Open the Vercel dashboard.

Say: Attio syncs one way into a Postgres mirror on Render through a read-only connector, and the CRM health audit runs against that mirror. This is the RevOps view. It is not a lead board. It answers whether the CRM can be trusted: missing owners, stale stages, duplicate accounts, contacts with no account, fields that disagree with their source. Every finding has a severity and a rule behind it, so the person who owns the CRM gets a list of things to fix, not a chart.

Be honest on camera: what is on screen right now is the frozen practice fixture, 22 findings, 15 critical and 7 warning. Running the audit against the live Georgia mirror produced 142 findings, and wiring those into this screen is listed in the gap statement.

## Stop 6: the drafted email and the stop line (about 60 seconds)

Show the output of `npm run lemlist:draft` for the trace contact (the gitignored file under `data/georgia-sample/private/drafts/`, or the terminal run).

Say: the drafting step builds a fact sheet from the operator's own public record, the K-tags cited, the dates, the repeats, and has Claude write one subject, opener, and body per contact. Read the draft aloud. It names the specific tag and the pattern, something like a sprinkler ITM citation recurring at three inspections since 2024, and offers the fix, never a generic pitch.

Then the stop line: the draft sits in a file with empty review fields. Enrollment reads Attio, checks opt-out and do-not-call, requires approval by membership of an Attio List, writes an idempotent ledger entry, and has a kill switch. Only after a human marks the draft reviewed does enrollment carry it to Lemlist as variables. No campaign has been launched, no mailbox or sending domain exists, no real contact has been enrolled, and the phone handoff to TitanX is not built.

## Closing (about 15 seconds)

Say: public federal data in, an explained score out, named contacts under a review queue, an auditable CRM, and a drafted email that stops at a human. The gap statement lists what is left.
