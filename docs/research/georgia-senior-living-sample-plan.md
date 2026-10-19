# Georgia Senior-Living Sample: Pipeline Plan and Source Checks

Status: proposed working plan, not yet approved. No money has been spent. This is the build plan for the first Georgia market sample under `docs/decisions/0007-first-georgia-sample-and-enrichment.md`, which is Track B under decision 0008. The budget is $0, free tiers only, under the 2026-10-19 amendment to decision 0007.

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
- The live replacement appears to be the Healthcare Facility Regulation public search in the Georgia MMIS portal. It is a form-based search with no export.
- Approved path, chosen by the user on 2026-10-19: a small, polite scraper of that public search. No records request is sent. Before it runs, the scraper's build checks the portal's terms of use and robots rules, keeps requests slow and sequential, and stores raw pages only in the gitignored raw-data folder. If the terms forbid automated access, the scraper is not built and the sample stays nursing-home-only.

### Repository visibility

The GitHub repository is public. The personal data boundary in decision 0007 therefore applies at its strictest: no names of individuals, emails, or phone numbers in committed files, screenshots, or artifacts.

## Pipeline

Each stage ends with a reviewable artifact and a count. Every stage runs on free sources or free tiers. When a free tier runs out, that stage stops and reports its coverage instead of buying more.

### Stage 1: facility universe (free)

Pull Georgia records from the three CMS datasets into a gitignored raw-data folder. Commit only a source manifest recording dataset identifier, CMS modified date, retrieval date, row count, and file checksum. Assisted living and personal care homes join once the state-portal scraper has run. The first pass does not wait for it.

### Stage 2: operator resolution (free)

Resolve each facility to an operator using `chain_id` first, then organizational owners with operational or managerial control in the ownership file, then legal business name. Facilities whose operator is unclear go to a manual review list instead of being merged. Output: operator accounts with parent-site links, each link citing its source field.

### Stages 1 and 2: first run, 2026-10-19, awaiting review

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

### Stage 4: qualification and signals (free)

- Map fire safety tags to Anchorpoint service lines, such as alarm testing, sprinkler maintenance, extinguishers, emergency lighting, and kitchen hood suppression. Confirm each tag against CMS's free Citation Code Look-up dataset (`tagd-9999`) before relying on it.
- Count service-line-relevant citations per facility and roll them up to the operator, keeping severity, recency, repetition, and correction status as evidence.
- Use ownership association dates as the change-of-ownership signal.
- Use Serper to find operator domains and current facilities, maintenance, or regional-operations job postings. About 200 operators at three queries each is roughly 600 queries, which fits inside Serper's reported free allowance. If the allowance runs out, domain lookups take priority over job postings.

### Stage 5: tiering (free)

Tier operators 1 to 4 using the priority bands and soft-scoring rules in `docs/contracts/scoring-contract.md` and decision 0001. No new weights are invented here. Any weight the contract leaves open is proposed separately for approval. The output is a tiered operator list with visible reasons, which is the artifact an executive would sign off.

### Stage 6: people (free tier only)

Only for serviceable, tiered operators, highest tier first. Run on Clay's free plan only: prove the table design for roles at the operator level and the site level, and measure the share of operators where named people can be found at all. The pass stops when free credits run out and reports how many operators it covered. There is no upgrade to a paid plan. Emails are checked for verifiability on a capped subset, and only whether a verified channel exists is recorded. Phone enrichment stays excluded.

### Stage 7: load

Under the 2026-10-19 amendments to decisions 0005 and 0008, real Georgia operators and facilities load into the Developer Edition org as Accounts and Sites, and Track A's fictional history may attach to them. Real people's contact details stay out of the public repository.

## Budget

The budget for the whole sample is $0.

- Serper and Clay run on free allowances only. Free-tier limits must be confirmed on each vendor's pricing page before relying on them.

## Decisions this plan needs from the user

- Accepted on 2026-10-19: the first pass may reach roughly 100 to 136 serviceable operators from nursing homes alone, below the 200 target, until the scraped state list is added.

## Sources

Retrieved 2026-10-19.

- CMS Provider Data Catalog, nursing home datasets `4pq5-n9py`, `ifjz-ge4w`, `y2hd-n93e`, and `tagd-9999`: https://data.cms.gov/provider-data/
- Georgia Department of Community Health, GaMap2Care find-facility page: https://dch.georgia.gov/node/32796
- Georgia MMIS Healthcare Facility Regulation public search: https://www.mmis.georgia.gov/portal/PubAccess.HFRD/tabId/57/Default.aspx
- Georgia licensing chapters for personal care homes and assisted living communities, as cited in HUD's 2025 Georgia certification: https://www.hud.gov/sites/dfiles/Housing/documents/Georgia_2025.pdf
