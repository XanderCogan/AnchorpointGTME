# Georgia Sample Stage 6: Clay People Pass Design

Status: proposed design, not yet approved or run. No Clay account is connected and nothing has been bought. This is Stage 6 of `georgia-senior-living-sample-plan.md`, governed by `docs/decisions/0007-first-georgia-sample-and-enrichment.md` as amended on 2026-10-20.

Date: 2026-10-20

Machine-readable parts:

- `data/georgia-sample/clay-role-map.json`: role slots, title filters, persona mapping, and proposed person-relevance points.
- `data/georgia-sample/people-coverage.schema.json`: the only shape Stage 6 results may take in the repository.

## Goal

Find, for the highest-priority eligible operators, whether a relevant buyer can be named at the operator and at its sites, and measure that rate per role. The pass proves the Clay table design and reports honest coverage. It does not try to finish the market. Nobody is contacted.

## Scope and run order

Inputs come from the approved tiering in `data/georgia-sample/tiers.json` (proposal 2, approved 2026-10-20): 82 eligible operators, 5 in band A, 11 in B, 41 in C, and 25 in Watch.

- Watch operators and the 38 operators outside the footprint are excluded.
- That leaves 57 operators and 220 footprint facilities: band A has 5 operators and 124 sites, band B 11 and 49, band C 41 and 47.
- All band A and B operators are multi-site. Band C has 4 multi-site operators and 37 single-site operators.

Rows run in band order A, then B, then C, highest score first inside a band.

- Every band runs at full depth: all 20 multi-site operator rows and all 220 footprint sites. The user set full depth for band A on 2026-10-20, and the one-day paid run below makes it affordable for B and C too.
- Band A runs first: 5 operator rows and 124 sites. Then band B's 11 operators and 49 sites, then band C's 4 multi-site operators and 47 sites.

Depth means every site and every role slot, not more detail about any person. The personal data boundary below is unchanged.

Within an operator, sites are ranked by the most recent service-line citation in `signals.json`, ties broken by shorter drive time in `serviceability.json`, so the sites with a reason to talk come first. The `wave` field in the coverage schema records whether a site row ran in the first paid or free batch (1) or a later one (2).

A single-site operator has no regional layer, so its operator row is marked `site_only` and only its site row runs. If the CMS ownership data shows a separate management organization, that organization is a later candidate for an operator row, not part of this pass.

## Clay table design

Both tables are built from committed business facts only. `npm run sample:georgia:clay-export` (`scripts/georgia-sample/clay-export.ts`) writes the input CSVs into the gitignored `data/georgia-sample/private/clay/input/` folder for upload: `operators.csv` with 20 rows, `sites-band-a.csv` with 124, and `sites-band-bc.csv` with 96.

### Operator table (20 multi-site operator rows)

Input columns:

- `operatorId`, `name`, `band`, `score`, `footprintFacilities`, and `identityStatus` from `tiers.json`
- `domain` from the `domain` component input in `tiers.json`, which carries the Serper name or word match; operators with no confirmed domain search by company name and are flagged lower confidence
- `georgiaFacilityCount` and `cmsChainId` from `operators.json`
- `runOrder`, computed from band and score

Enrichment columns, in order:

1. Find people at company, filtered by the `operator_regional_facilities` title patterns, limited to 2 results, United States.
2. The same search for `operator_operations_vp`, limited to 2 results.
3. Enrich each found person's profile for current employer, current title, and current-role start date.
4. Formula columns that reduce each slot to the coverage fields listed under the personal data boundary.

### Site tables (124 band A rows, then 96 band B and C rows, each under the free plan's 200-row limit)

Input columns:

- `ccn`, `facilityName`, `city`, `zip`, `county`, and `certifiedBeds` from `facility-operator-links.json`
- `operatorId`, `band`, and `domain` joined from the operator inputs
- `siteRank` and `wave` from the ranking above

Enrichment columns:

1. Find people at company for `site_executive_director`, filtered by the operator domain or name plus the facility city, limited to 1 result.
2. The same for `site_maintenance_director`, limited to 1 result.
3. Profile enrichment and reduction formulas, as in the operator table.

Single-site facilities often list the facility, not a parent, as employer, so their search uses the facility name and city. If Clay's people search misses a site, Claygent may read the operator's public leadership or facility page, as decision 0007 allows. Claygent cost depends on the model chosen and is capped at 10 credits for the whole pass.

### Channel check on a capped subset

Decision 0007 asks for email-verification rates on a capped subset, not for emails. The subset is the first 20 people found, band A operator roles first. For each, Clay's work-email waterfall runs and a free validator checks the result. A formula keeps only the outcome (`clay_email_waterfall_validated`, `found_not_valid`, or `not_found`), and the email column is deleted from the table after the run. Phone enrichment is excluded and is not available on the free plan anyway.

## Roles and personas

The role map follows decision 0007's buyer roles and maps each to an approved persona in `docs/contracts/operating-contract.md`. Person-relevance points stay inside the scoring contract's existing caps: up to 8 for direct functional ownership, 5 for regional, budget, vendor, or implementation influence, and 2 for an adjacent role with a credible path to the owner. The split per slot is a proposal.

- Regional or corporate maintenance, facilities, or plant operations director, at the operator: Regional Facilities Manager, or Vice President or Director of Facilities when the title is corporate. Proposed 13 of 15: 8 direct ownership and 5 regional influence.
- Regional or corporate vice president of operations, at the operator: Senior-Living Operations Leader, a provisional persona added to the operating contract on 2026-10-20. Treated as the economic buyer rather than the first contact, decided by the user on 2026-10-20. When no regional facilities person is found at an operator, the operations leader becomes the first contact. This is a routing rule and changes no points. Proposed 7: 5 influence and 2 adjacent.
- Maintenance director, at the site: Director of Property Operations, as its site-level holder. Proposed 10: 8 direct ownership and 2 implementation influence.
- Executive director or administrator, at the site: Site Administrator, a provisional persona added to the operating contract on 2026-10-20. Proposed 7: 5 influence and 2 adjacent.

Every slot fills the same three scoring inputs:

- Role change, up to 16 under change propensity, from the current-role start date, reduced to a tenure band kept in `private/`.
- Person relevance, up to 15, from the slot's mapped persona.
- Persona and channel, up to 4 under data confidence: 2 for persona and current employment verified, 2 for a verified channel.

Health rule `CRM-DATA-001` requires persona mapping to follow a versioned deterministic map with uncertain results sent to review. The role map is that map, versioned `georgia-clay-role-map-1`. A found title that matches no include pattern, or matches an exclude pattern, gets `personaVerified: false` and no person-relevance points.

## Budget and credit math

### Verified facts

Retrieved from Clay's own pages on 2026-10-20:

- The free plan gives 100 data credits and 500 actions a month, unlimited tables, up to 200 rows per table, multi-provider waterfalls, Claygent, and bring-your-own API keys. It excludes phone enrichment, CRM integrations, the HTTP API, and scheduled runs. Source: https://www.clay.com/pricing
- Paid plans start at Launch, listed at $54 a month billed annually and $60 a month billed monthly, with 3,000 data credits and 15,000 actions. The same page's FAQ gives Launch as starting at $185 a month, so the page is internally inconsistent. Source: https://www.clay.com/pricing
- Data credits "start at $0.05 each". One-time top-ups carry a 30 percent premium and have a minimum of 250 credits. Automatic top-ups are not available on the free plan. The docs do not say whether a free-plan account can buy a one-time top-up. Sources: https://www.clay.com/pricing and https://university.clay.com/docs/actions-data-credits
- Sourcing people uses data credits but not actions, unless the data is free or comes through your own API key. Each record enriched counts as one action. Clay's worked example prices profile enrichment at 0.5 data credits and a found work email at 0.5, with select validators free. Source: https://university.clay.com/docs/actions-data-credits
- Clay does not publish a per-person price for Find People. The docs say the enrichment panel shows the cost before a run. Source: same.

### Assumptions

- Find People costs about 1 data credit per person returned. This is the largest unknown and must be read from Clay's enrichment panel before the first run.
- A search that returns nobody costs nothing. The docs' email example bills only successful finds, but this is not confirmed for people search.
- Estimates below are worst case, with every slot filled. Real costs scale with the find rate.

Under these assumptions a person costs about 1.5 credits (1 to find, 0.5 to enrich). A full operator row is 4 people, about 6 credits. A full site row is 2 people, about 3 credits. The 20-person channel check is about 10 credits.

### One-day run, paying for speed

Decided by the user on 2026-10-20: the project runs in one day, and the user will pay beyond the $20 Clay cap if the free plan cannot finish the pass in time. Waiting for monthly free credits is out. Each purchase is still confirmed with the user at the price Clay shows.

The whole pass at full depth, worst case:

- Band A: 5 operator rows (about 30 credits) and 124 site rows (about 372), about 402 credits.
- Band B: 11 operator rows (about 66) and 49 site rows (about 147), about 213 credits.
- Band C: 4 multi-site operator rows (about 24) and 47 site rows (about 141), about 165 credits.
- Channel check: about 10 credits.

That is about 790 credits in the worst case, or about 400 at a 50 percent find rate with misses free. Actions are not the constraint.

The run in order:

1. Free plan, 100 credits: build both tables and run band A's operator rows and first sites. Read the real per-person cost in Clay's enrichment panel and the find rate from these rows.
2. Re-estimate the remaining credits from those two measured numbers.
3. Buy the cheaper option that covers the estimate. One-time top-ups, if the free plan allows them, cost $16.25 per 250 credits, so about $50 covers the worst case. One Launch month, listed at $60 billed monthly with 3,000 data credits, covers everything with room to spare and can be cancelled after. The pricing page also shows a $185 Launch figure, so the price is read in Clay at checkout.
4. Run bands A, B, and C at full depth, then the channel check.

Recommendation: unless the measured cost makes one $16.25 top-up enough, take the Launch month. Three top-ups cost about the same and leave no margin.

## Stopping rule

- Before each band batch, compare the remaining credits with the batch's worst-case estimate. Run only whole operator rows and whole site rows, so no row is left half-enriched.
- When the free credits run out, stop, report, and ask the user before buying, quoting the top-up or plan and price shown in Clay.
- When the purchased credits run out, stop and report. A second purchase needs its own confirmation.
- On the free plan, a table holds at most 200 rows, so band A's 124 sites and the 96 band B and C sites sit in separate tables.

The stop report, written into `people-coverage.json` and summarized in the sample plan, gives:

- Operators covered and not reached, by band, and site rows covered and not reached, by band and wave.
- For each role slot: rows searched, rows with at least one person found, and the found-a-person rate.
- Persona-verified and current-employment-verified rates per slot.
- Channel-check outcomes on the subset, counted by outcome.
- Free and paid data credits used, actions used, dollars spent, and the reason the run stopped.

## Personal data boundary

The repository is public, so decision 0007's boundary applies at its strictest.

Stays in Clay, never in git:

- Names, titles as written, profile links, employer strings, and exact role start dates.
- Email values, which exist in Clay only long enough to validate and are then deleted from the table.

Phones are never requested.

Clay exports go to `data/georgia-sample/private/clay/export/`, which is gitignored, with the same file names as the inputs plus a hand-written `run.json` holding run dates, credits, actions, dollars, and the stop reason. `npm run sample:georgia:clay-reduce` (`scripts/georgia-sample/clay-reduce.ts`) turns them into `data/georgia-sample/people-coverage.json`. It reads only the reduction columns below and ignores every other column, validates the result against `people-coverage.schema.json`, and scans it for anything shaped like an email, a link, the word LinkedIn, or a phone number. If either check fails, nothing is written. `tests/clay-people-pass.test.ts` feeds it a fake export full of names, links, emails, and phones and checks that none get through.

Each Clay table ends with formula columns named `<slot>__<field>`, where the slot is a role slot id from the role map:

- `__searched`: true once the slot's search ran
- `__found`: people found, 0 to 2 at the operator and 0 to 1 at a site
- `__persona_verified`: true when a found title matches the slot's include patterns and none of its excludes
- `__employment_verified`: true when the profile shows the operator or facility as the current employer
- `__tenure_band`: the most recent verified person's band, which the reducer turns into points and never writes out
- `__channel`: one of the channel outcomes in the role map

Comes back into the repository, per operator row and per site row, and nothing else:

- Identifiers already committed: `operatorId`, `ccn`, `band`, `wave`, and a status of covered, not reached, or site only.
- Per role slot: whether it was searched, how many people were found (0 to 2), whether the persona and current employment were verified, and a channel outcome.
- Per operator: role-change points and a generic reason, with no slot or site attached.
- Run totals: credits, actions, dollars, run dates, and the stop reason.

Decided by the user on 2026-10-20: tenure bands (under 6 months, 6 to 12, 12 to 24, over 24, or unknown) stay in `private/`. A band tied to a named facility's maintenance director could help someone identify that person. The repository gets only each operator's account-level role-change points and a generic reason, such as a verified facilities leader who started recently.

The demo may show names only to authenticated users, from the database, as decision 0007 allows. Real-person data is deleted when the project ends, including the Clay workspace tables.

## How results reach the score

No weights change. Stage 6 fills components that `tiers.json` already holds at zero as "unknown until Stage 6", plus person relevance, which has no component yet. Wiring them into `tier.ts` belongs to the session that owns it.

- `roleChange`, up to 16: from the most recent tenure band among the account's verified people. The contract leaves the decay function to the scoring milestone, so the reducer applies `role-change-proposal-1`, approved by the user on 2026-10-20: 16 times one minus the band's midpoint months over 24, giving 14, 10, and 4 points for the under 6, 6 to 12, and 12 to 24 month bands. This mirrors the 24-month decay tier.ts proposes for ownership change. Unknown tenure scores zero, and long tenure is never a penalty.
- Person relevance, up to 15: the highest proposed slot value among verified people at the operator or its covered sites. Taking the best person rather than a sum is a proposed rollup rule.
- `personaAndChannel`, up to 4: 2 if any verified person has persona and current employment confirmed, 2 if any of them has a validated channel.
- `engagement` stays as it is, used by the citation trigger proposal.

Each awarded point carries its input (a slot, a band, or an outcome, never a person), its source (Clay, with run date and role map version), and its freshness, as the contract requires. Rescoring with these inputs adds up to 35 points to an account's current maximum of 65, so bands should be re-inspected after Stage 6 rather than read as moving by themselves.

## Runbook: when Clay is connected

Start here if Clay is connected and nothing seems to work. These steps are in order, and each one has a check.

1. Run `npm run sample:georgia:clay-export`. Check: it reports 20 operator rows, 124 band A site rows, and 96 band B and C site rows, written to `data/georgia-sample/private/clay/input/`.
2. In Clay, import `operators.csv`, `sites-band-a.csv`, and `sites-band-bc.csv` as three tables. Check: no table is over 200 rows, the free plan's limit.
3. Add the enrichment columns described under "Clay table design", using the title patterns in `data/georgia-sample/clay-role-map.json`. Before running a whole table, run one row and read the credit cost Clay shows. Check: it is near the assumed 1.5 credits per person. If it is far off, redo the credit math before spending.
4. Add the summary formula columns, named exactly `<slot>__searched`, `<slot>__found`, `<slot>__persona_verified`, `<slot>__employment_verified`, `<slot>__tenure_band`, and `<slot>__channel`, as described under "Personal data boundary". The slot names are `operator_regional_facilities` and `operator_operations_vp` in the operator table, and `site_executive_director` and `site_maintenance_director` in the site tables. Two underscores separate the slot from the field. Check: the names match exactly. A misspelled name is the most likely reason the reducer fails.
5. Run band A, then B, then C, following the stopping rule. Ask before any purchase.
6. Export each table as CSV into `data/georgia-sample/private/clay/export/`, keeping the file names `operators.csv`, `sites-band-a.csv`, and `sites-band-bc.csv`. Write `run.json` beside them with `clayRunDates`, `freeDataCreditsUsed`, `paidDataCreditsUsed`, `actionsUsed`, `paidUsd`, and `stoppedBecause`.
7. Run `npm run sample:georgia:clay-reduce`. Check: it prints the found-a-person rate per role and writes `data/georgia-sample/people-coverage.json`. Commit only that file.

If the reducer fails, its message says why:

- "Missing ...": the input or export folder, or `run.json`, is not where step 1 or step 6 puts it.
- "missing reduction columns": a summary column from step 4 is misnamed or missing in an export. The message lists each expected name.
- A schema error or "personal-data pattern": a value outside the allowed codes, or something shaped like an email, link, or phone number, reached the output. Fix the summary formula in Clay; never loosen the schema or the scan to get past it.

## Open questions for the user

1. Can a free-plan account buy a one-time top-up? Clay's docs do not say. Resolved 2026-10-20: the run pays for speed, so this only decides between top-ups and a Launch month.
2. Review later: the two provisional senior-living personas in the operating contract, and any generic persona that does not fit, once Stage 6 shows which titles actually exist.
3. Approve the proposed person-relevance points per slot (13, 7, 10, 7) and the best-person rollup.
4. Resolved 2026-10-20: `role-change-proposal-1` is approved.
5. Resolved 2026-10-20: tenure bands stay in `private/`, and only account-level role-change points with a generic reason are committed.

## Sources

Retrieved 2026-10-20.

- Clay pricing page: https://www.clay.com/pricing
- Clay University, actions and data credits: https://university.clay.com/docs/actions-data-credits
- Clay University, work email waterfall (search result only, not read in full): https://university.clay.com/docs/work-email-waterfall
