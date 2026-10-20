# Georgia Senior-Living Sample: Pipeline Plan and Source Checks

Status: proposed working plan, not yet approved. No money has been spent. This is the build plan for the first Georgia market sample under `docs/decisions/0007-first-georgia-sample-and-enrichment.md`, which is Track B under decision 0008. The budget is $20 for Clay and $20 for one other service, with free tiers used first, under the 2026-10-20 amendment to decision 0007.

Last updated: 2026-10-19

## Source checks completed

All checks used free public endpoints and returned metadata or aggregate counts only. No facility or person records were saved.

### CMS nursing home data: confirmed and stronger than expected

The CMS Provider Data Catalog API is open, needs no key, and was refreshed on 2026-09-30.

- Provider Information (`4pq5-n9py`) lists 356 Georgia nursing homes. Each record carries the certification number, legal business name, address, bed count, ownership type, `chain_id`, `chain_name`, number of facilities in the chain, a change-of-ownership flag for the last 12 months, and a flag for sprinklers in all required areas.
- Fire Safety Deficiencies (`ifjz-ge4w`) holds 3,482 Georgia citations, with survey date, deficiency category, tag number, scope and severity code, and correction date.
- Ownership (`y2hd-n93e`) holds 5,385 Georgia rows naming owners and managers, their type, role, percentage, and association date.

What the counts mean for the plan:

- Parent resolution is mostly free. 248 of the 356 facilities belong to 28 CMS-identified chains: 13 chains have five or more Georgia facilities, 10 have two to four, and 5 have one. The other 108 facilities are standalone. That gives roughly 136 nursing-home operator accounts before serviceability filtering, so nursing homes alone fall short of the 200-operator target.
- A fire citation alone does not discriminate. 287 of the 356 facilities were cited at least once since January 2025, across 1,560 citations led by smoke, egress, and services categories. The useful signal is the specific tag mapped to an Anchorpoint service line, its severity, whether it repeats, and whether it was corrected.
- Two flags carry almost no information in Georgia. Every facility reports sprinklers in all required areas, and only one changed ownership in the last 12 months. Ownership association dates are the better change signal.
- The ownership file names individual owners as well as companies. Individual owner names are personal data and are excluded from everything committed to this public repository.

### Georgia licensed assisted living and personal care homes: no bulk source yet

- GaMap2Care, named in decision 0007, appears retired. Its address returns HTTP 404 behind an expired certificate.
- Corrected 2026-10-20: the live replacement is the Healthcare Facility Regulation inspection report search at https://weblink.dch.georgia.gov/WebLink/CustomSearch.aspx?SearchName=InspectionReportSearch&repo=WEB, linked from https://forms.dch.georgia.gov/HFRD/. The earlier MMIS link pointed to an attachment-upload page. The search is public, covers about 24,000 surveys from the past three years across nursing homes, assisted living communities, and personal care homes, and posts surveys within about a day. It has no export, but the page loads results from a JSON endpoint (`SearchService.aspx/GetSearchListing`) that returns facility, address, administrator, licensed beds, citation count, survey date, and violation flag per report. Reports are scanned state licensure surveys, not federal Life Safety Code findings; see `cms-fire-citations-georgia.md`.
- Approved path, chosen by the user on 2026-10-19: a small, polite scraper of that public search. No records request is sent. Before it runs, the scraper's build checks the portal's terms of use and robots rules, keeps requests slow and sequential, and stores raw pages only in the gitignored raw-data folder. If the terms forbid automated access, the scraper is not built and the sample stays nursing-home-only.

### Repository visibility

The GitHub repository is public. The personal data boundary in decision 0007 therefore applies at its strictest: no names of individuals, emails, or phone numbers in committed files, screenshots, or artifacts.

## Pipeline

Each stage ends with a reviewable artifact and a count. Every stage runs on free sources or free tiers first. When a free tier runs out, paid spend is allowed only within the caps under Budget. When those run out too, that stage stops and reports its coverage.

### Stage 1: facility universe (free)

Pull Georgia records from the three CMS datasets into a gitignored raw-data folder. Commit only a source manifest recording dataset identifier, CMS modified date, retrieval date, row count, and file checksum. Assisted living and personal care homes join once the state-portal scraper has run. The first pass does not wait for it.

### Stage 2: operator resolution (free)

Resolve each facility to an operator using `chain_id` first, then organizational owners with operational or managerial control in the ownership file, then legal business name. Facilities whose operator is unclear go to a manual review list instead of being merged. Output: operator accounts with parent-site links, each link citing its source field.

### Stages 1 and 2: first run, 2026-10-19

`scripts/georgia-sample/pull-cms.ts` pulls the four CMS datasets into the gitignored `data/georgia-sample/raw/` folder and writes `data/georgia-sample/source-manifest.json`. A second pull on the same day produced identical checksums. `scripts/georgia-sample/resolve-operators.ts` writes `operators.json`, `facility-operator-links.json`, and `operator-review.json` beside the manifest. These files hold business facts only and are committable.

Results from the 2026-09-30 CMS release:

- 356 facilities resolve to 128 operator accounts, 29 of them multi-site in Georgia.
- 28 operators come from CMS chains (248 facilities), 5 from a corroborated organization with operational or managerial control, and 95 from legal business name.
- 95 operators are resolved and 33 are provisional, because at least one of their facilities is on the review list.
- The review list holds 41 cases: 36 facilities and 5 chains.

Rules found while building, beyond the plan:

- The ownership file's operational or managerial control role also covers contractors such as therapy, dining, dialysis, and lending firms. An organization becomes the operator only when it is the single corroborated candidate. Corroborated means it also holds an ownership interest in the facility, or it shares a distinctive name word with the facility, not counting the facility's city or county. Uncorroborated or competing candidates go to review.
- 18 facilities have neither a legal business name, which CMS shows as the placeholder "Legal Business Name Not Available", nor any ownership data. Each stands alone under its CCN and goes to review rather than being grouped by the placeholder.
- Five CMS chain names are individuals' names. Their facilities stay grouped by `chain_id`, but the names are withheld from committed files, and each chain goes to review for a publishable organization name. More generally, any committed name with no organizational word, or with trust or family wording, is withheld. The resolver also fails the run if any individual owner's full name appears in its output.
- Operator identifiers are stable across reruns of the same release: `ga-op-chain-<chain_id>`, `ga-op-org-<name>`, `ga-op-lbn-<legal name>`, or `ga-op-ccn-<ccn>`.

### Stage 3: serviceability (free, one open choice)

Apply decision 0003: nearest capable branch, estimated drive time, and serviceability state with its reason. The drive-time source is still open in decision 0003. The recommendation is a free routing API's distance matrix, since about 356 facilities against four branches is small; this needs a pricing and terms check before use. If none fits, straight-line distance times a road factor can stand in, labeled as an estimate and never shown as a measured drive time.

### Stage 3: first run, 2026-10-19, on OSRM road drive times

`scripts/georgia-sample/serviceability.ts` writes `data/georgia-sample/serviceability.json`. For each facility and each of the five recurring service lines, it records the nearest branch offering that line, the drive minutes and road miles, the state, and the reason.

Drive times come from the OSRM public demo server's table service, using OpenStreetMap data and the car profile. The user approved it on 2026-10-19 after a straight-line estimate proved inadequate. Its published terms allow non-commercial use at no more than one request per second. The full FOSSGIS terms page blocked automated reading. The run used four sequential requests, and raw responses are cached in the gitignored raw folder. Facility coordinates come from CMS (`4pq5-n9py.latitude` and `longitude`). The fictional branches sit at city centers. This resolves the drive-time source left open in decision 0003 for this sample.

Results:

- Of 356 facilities, 185 are fully serviceable, 95 partially serviceable, and 76 not serviceable. Every facility was routable and within 500 meters of a road.
- For sprinkler work, 188 facilities are serviceable, 58 conditional, and 110 not serviceable.
- Of 128 operators, 71 are serviceable and 17 conditional for sprinkler or alarm work at one or more facilities. 62 of those 88 are resolved operators; the rest are provisional.
- 52 facilities sit within 5 minutes of the 90- or 120-minute edge on some line.
- OSRM times are free-flow without traffic. Spot checks look 10 to 25 percent slower than typical consumer-map times on some routes, such as Norcross to Rome at 91 minutes. This is a judgment, not a measured comparison. Treat facilities near a band edge as uncertain either way.

Assumptions recorded in the output: Georgia licenses are company-wide, so Greenville may serve Georgia sites; alarm monitoring resale is left out while decision 0003 keeps it open; every nursing home is assumed to need all five lines until Stage 4 adds citation evidence.

### Stage 4: qualification and signals (free)

- Map fire safety tags to Anchorpoint service lines, such as alarm testing, sprinkler maintenance, extinguishers, emergency lighting, and kitchen hood suppression. Confirm each tag against CMS's free Citation Code Look-up dataset (`tagd-9999`) before relying on it.
- Count service-line-relevant citations per facility and roll them up to the operator, keeping severity, recency, repetition, and correction status as evidence.
- Use ownership association dates as the change-of-ownership signal.
- Use Serper to find operator domains and current facilities, maintenance, or regional-operations job postings. About 200 operators at three queries each is roughly 600 queries, which fits inside Serper's reported free allowance. If the allowance runs out, domain lookups take priority over job postings.

### Stage 4: first run of the public-data signals, 2026-10-19

`scripts/georgia-sample/signals.ts` writes `data/georgia-sample/signals.json` with per-facility evidence and an operator rollup. The Serper part of this stage is recorded in the next section.

Tag mapping. Thirteen Life Safety Code tags map to the five catalog lines. Each was confirmed against `tagd-9999`, and the output records its CMS wording.

- Sprinkler: K-0353 and K-0352 as inspection, testing, and maintenance; K-0351 as install or repair.
- Fire alarm: K-0345 as inspection, testing, and maintenance; K-0341, K-0342, K-0343, and K-0347 as install or repair.
- Extinguishers: K-0355.
- Kitchen hood: K-0324. Its CMS wording covers cooking facility protection broadly, so it is a looser match.
- Emergency lighting: K-0291 as testing; K-0293 and K-0281 as install or repair.
- Electrical, generator, medical gas, egress, and staff-procedure tags map to no catalog line and are not counted. They include K-0511, the second most common Georgia tag.
- Amended 2026-10-20 under decision 0003: fire door inspection (K-0761) and door and barrier repairs (K-0363, K-0374, K-0223, K-0372) now map to two new lines, `fire_door_itm` and `firestopping`. Inspections are self-performed; the repairs and K-0351 sprinkler installation are marked `delivery: "subcontract"`.

Results from 3,482 Georgia fire safety citations:

- 1,257 citations map to a service line: sprinkler 539, fire alarm 286, emergency lighting 235, kitchen hood 110, and extinguishers 87.
- 314 of 356 facilities have one or more service-line citations, and 233 have one since 2025-01-01.
- 151 facilities were cited for sprinkler work on more than one survey date. Repetition separates facilities better than presence does.
- Only 8 service-line citations lack a correction date, so correction status carries little signal in Georgia.
- 41 facilities show an ownership or partnership interest dated within the 24 months before retrieval, or the CMS change-of-ownership flag. 20 show a new management organization. Individuals with managerial control are excluded, because their dates mostly track administrator turnover; including them had flagged 138 facilities.
- Of the 88 operators in the serviceable or conditional footprint, 82 have service-line citations, 59 have recent ones, 13 have an ownership change, and 7 a management change.

Rerun 2026-10-20 with the two added lines:

- 1,816 of 3,482 citations (52%) map to a service line. The new lines add fire doors 347 and firestopping 212.
- 332 of 356 facilities have one or more service-line citations, and 262 have one since 2025-01-01.
- Correction dates are the facility's committed date, clustered at 45 days after the survey in Georgia, not the repair date. They are recorded as such in `signals.json` and not used to measure repair time.
- The release's newest survey is 2026-07-16 against a 2026-09-01 processing date, a minimum lag of 47 days and more by publication. Citations therefore arrive after the correction window and serve as a targeting and history signal, not a real-time trigger.

### Stage 4: Serper domain and job lookups, 2026-10-19

`scripts/georgia-sample/serper-lookups.ts` writes `data/georgia-sample/web-signals.json`. The run used about 250 of Serper's 2,500 free queries, a figure confirmed on serper.dev on 2026-10-19, including tuning. Serviceable operators ran first, and raw responses are cached in the gitignored raw folder, so reruns cost nothing. Multi-site, chain, and managing-organization operators were searched by name. Single-site operators were searched by facility name and city.

Domains for all 128 operators:

- 30 are name matches: the host spells out the operator's or facility's leading name words and includes a distinctive word, such as beaconhealthmanagement.com or agrhodes.org.
- 24 are word matches: the host shares one distinctive word and the result places itself in Georgia or a facility city. Most are right, such as archbold.org for Grady General, but these need a glance before use.
- 74 have no confirmed domain. Their top remaining result is kept only as a `candidateDomain` hint, usually an aggregator.
- Among the 88 operators in the footprint, 24 have name matches and 14 word matches.
- Tuning lessons: quoting the name in the query hurt results; a single shared word is not enough without a place check; and a domain matched by two operators, such as a Life Care careers site, identifies neither.

Job postings for the 88 footprint operators:

- 10 operators have posting candidates: single job pages whose title names a maintenance, facilities, or plant operations role and whose title or address names the operator. Search, salary, and review pages are excluded.
- Search cannot confirm a posting is open or for the right facility. A PruittHealth Fort Oglethorpe posting attaches to several PruittHealth sites. Treat this as a weak signal.

Stage 2 finding from these lookups: several of the 18 facilities with no CMS legal name are named for CMS chains and hiring under them. They include "PruittHealth - Lithonia" and "Pine Knoll Path of Journey". They belong in review as probable members of chains 434 (PruittHealth) and 766 (Journey) rather than standalone operators.

### Stage 5: tiering (free)

Tier operators 1 to 4 using the priority bands and soft-scoring rules in `docs/contracts/scoring-contract.md` and decision 0001. No new weights are invented here. Any weight the contract leaves open is proposed separately for approval. The output is a tiered operator list with visible reasons, which is the artifact an executive would sign off.

### Review decisions and the one-command pipeline, 2026-10-20

Approved review decisions live in `data/georgia-sample/review-decisions.json`, and the resolver applies them on every run. Each decision names a CCN, the operator it joins, the approval date, and the evidence. On 2026-10-20 the user approved eight merges. Three facilities with no CMS legal name join PruittHealth (chain 434), which now has 63 Georgia facilities. Five join Journey (chain 766), which now has 27. After the merges, 356 facilities resolve to 120 operators, and 33 review cases remain.

`npm run sample:georgia` reruns resolution, serviceability, signals, Serper lookups, and tiering from the raw data, with OSRM and Serper served from cache. `npm run sample:georgia:pull` refreshes the CMS pull separately.

### Stage 5: tiering, proposal 2 approved on 2026-10-20

`scripts/georgia-sample/tier.ts` writes `data/georgia-sample/tiers.json`. It applies `account-score-v1.1`. Every value the contract leaves open sits in one labeled proposal block, now `georgia-account-proposal-2`, and is marked as a proposal on each scored component until the user approves it.

- Hard gate: an operator needs one or more facilities serviceable or conditional for sprinkler or alarm work. 82 operators pass and 38 sit outside the footprint.
- Change propensity, using 24 of 40 points. Ownership or management change gets up to 10 points, decaying over 24 months from the latest association date. Hiring gets up to 8: 4 for an undated posting candidate, more for a dated one decaying over 120 days. A service-line citation is proposed as the contract's "approved timely trigger", up to 6 points decaying over 24 months.
- Operational need, 35 points. Footprint earns up to 15 on a smooth curve over facilities within 120 minutes of a capable branch, with no cutoffs. Every nursing home gets 5 for its regulated environment. Up to 10 go to the share of footprint facilities cited for a service line since 2025, and up to 5 to the share with repeated sprinkler or alarm citations. Since proposal 2, both shares are pulled toward the statewide footprint rate, 68 percent cited since 2025 and 41 percent repeated, as if each operator also had two average facilities. One cited building now earns about three-quarters of the breadth points rather than all of them.
- Data confidence, using 6 of 10 points. Domain earns 2 for a name match and 1 for a word match. Geography earns 2 if any facility is within 90 minutes, 1 if all are conditional. Location provenance earns 2 for a resolved operator, 1 for a provisional one.
- People-based inputs score zero as unknown until Stage 6: role change (16), engagement (6, used by the citation trigger proposal), and persona and channel (4). Today's maximum is therefore 65 of 100.
- Proposed bands on the raw score, after inspecting the distribution: A from 40, B from 30, C from 20. After the 2026-10-20 rerun with fire door and firestopping lines, that gives 5 A, 15 B, 38 C, and 24 Watch, with scores from 8 to 48.8 and a median of 26.3. The first run gave 5 A, 14 B, 35 C, and 28 Watch. Five operators moved up one band; band A is unchanged. Proposal 2, run on 2026-10-20 at the user's direction to fix single-site inflation, gives 5 A, 11 B, 41 C, and 25 Watch, with scores from 14 to 49 and a median of 23.3. Four operators moved from B to C and one from C to Watch; band A is unchanged.
- Band A: PruittHealth, Journey Healthcare, Harborview Health Systems, Empire Care Centers, and Ethica Health.

Known effects to weigh before approval:

- Proposal 1 scored citations as raw shares, so a single-site operator with one recent citation earned the full 15 citation points. Proposal 2 fixes that. Single-site operators still make up 34 of 41 in band C, because there are 58 of them and they cluster between 20 and 27 points. None reaches band B.
- The score has no account-value input. It cannot yet say whether a 63-facility chain is worth more than its harder sale, or whether a small operator close to a branch is worth taking. The value model approved in `docs/decisions/0009-account-value-model.md` adds it beside the score.
- Larger chains have more chances to show an ownership change at some facility.
- 20 eligible operators are provisional, pending manual review.
- A Serper result during domain lookup suggested a Chapter 7 bankruptcy case for C. Ross Management. It is unverified and not scored, because the contract allows only inputs that are captured with a source.

### Stage 6: people (free tier, then up to $20)

The detailed design is in `georgia-clay-people-pass.md`. Only for serviceable, tiered operators, highest tier first. Start on Clay's free plan: prove the table design for roles at the operator level and the site level, and measure the share of operators where named people can be found at all. When free credits run out, up to $20 of paid Clay credit continues the pass, confirmed with the user before purchase. The pass stops when that is spent and reports how many operators it covered. Emails are checked for verifiability on a capped subset, and only whether a verified channel exists is recorded. Phone enrichment stays excluded.

### Stage 7: load

Under the 2026-10-19 amendments to decisions 0005 and 0008, real Georgia operators and facilities load into the Developer Edition org as Accounts and Sites, and Track A's fictional history may attach to them. Real people's contact details stay out of the public repository.

## Budget

The budget for the whole sample is $40, set by the user on 2026-10-20.

- Clay: up to $20, after the free plan runs out.
- One other service: up to $20, assigned when the build shows where it helps most, such as more Serper queries or email verification.
- Free allowances come first for every service. Free-tier limits must be confirmed on each vendor's pricing page before relying on them, and each purchase is confirmed with the user before it is made.

## Decisions this plan needs from the user

- Accepted on 2026-10-19: the first pass may reach roughly 100 to 136 serviceable operators from nursing homes alone, below the 200 target, until the scraped state list is added.

## Sources

Retrieved 2026-10-19.

- CMS Provider Data Catalog, nursing home datasets `4pq5-n9py`, `ifjz-ge4w`, `y2hd-n93e`, and `tagd-9999`: https://data.cms.gov/provider-data/
- Georgia Department of Community Health, GaMap2Care find-facility page: https://dch.georgia.gov/node/32796
- Georgia DCH Healthcare Facility Regulation inspection report search (retrieved 2026-10-20): https://weblink.dch.georgia.gov/WebLink/CustomSearch.aspx?SearchName=InspectionReportSearch&repo=WEB
- Georgia licensing chapters for personal care homes and assisted living communities, as cited in HUD's 2025 Georgia certification: https://www.hud.gov/sites/dfiles/Housing/documents/Georgia_2025.pdf
