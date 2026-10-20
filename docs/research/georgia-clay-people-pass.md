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

- Band A runs at full depth, decided by the user on 2026-10-20: all 5 operator rows and all 124 of their footprint sites. No per-operator site cap applies to band A.
- Bands B and C then run their 15 multi-site operator rows and 96 sites. Whether B and C also run at full depth, or operators first and sites after, is open.

Depth means every site and every role slot, not more detail about any person. The personal data boundary below is unchanged.

Within an operator, sites are ranked by the most recent service-line citation in `signals.json`, ties broken by shorter drive time in `serviceability.json`, so the sites with a reason to talk come first. The `wave` field in the coverage schema records whether a site row ran in the first pass (1) or a later one (2).

A single-site operator has no regional layer, so its operator row is marked `site_only` and only its site row runs. If the CMS ownership data shows a separate management organization, that organization is a later candidate for an operator row, not part of this pass.

## Clay table design

Both tables are built from committed business facts only. An export script, not yet written, writes the input CSVs into the gitignored `data/georgia-sample/private/clay/` folder for upload.

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
- Regional or corporate vice president of operations, at the operator: Director of Property Operations, flagged for review because operations leaders hold budgets and vendors but not facilities work. Proposed 7: 5 influence and 2 adjacent.
- Maintenance director, at the site: Director of Property Operations, as its site-level holder. Proposed 10: 8 direct ownership and 2 implementation influence.
- Executive director or administrator, at the site: Compliance or Risk leader with facilities responsibility, flagged for review because the administrator answers for survey compliance and approves site vendors but does not own facilities work. Proposed 7: 5 influence and 2 adjacent.

Every slot fills the same three scoring inputs:

- Role change, up to 16 under change propensity, from the current-role start date, reduced to a tenure band.
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

### Free plan, month by month

Decided by the user on 2026-10-20: if the free plan cannot buy a one-time top-up, the pass continues on later months of the free plan rather than a paid plan or another vendor.

The whole pass at full depth, worst case:

- Band A: 5 operator rows (about 30 credits) and 124 site rows (about 372), about 402 credits.
- Band B: 11 operator rows (about 66) and 49 site rows (about 147), about 213 credits.
- Band C: 4 multi-site operator rows (about 24) and 47 site rows (about 141), about 165 credits.
- Channel check: about 10 credits.

That is about 790 credits, or about 8 months of free credits in the worst case. At a 50 percent find rate with misses free, it is about 400 credits, or about 4 months. Band A alone takes about 2 to 4 months. Actions are not the constraint: a month uses at most about 200 of 500.

### Paid credit: up to $20, confirmed with the user first

If the free plan can buy a one-time top-up, the 250-credit minimum costs $16.25 at $0.05 plus the 30 percent premium, and $20 buys about 300 credits, about three free months' worth. It shortens the worst case from about 8 months to about 5.

If top-ups require a paid plan, Clay's cheapest monthly option is $60, three times the $20 cap. Under the 2026-10-20 choice, the pass stays on the free plan instead.

## Stopping rule

- Before each band batch, compare the remaining credits with the batch's worst-case estimate. Run only whole operator rows and whole site rows, so no row is left half-enriched.
- When a month's free credits run out, stop and report, then resume when they refresh. Ask the user before any purchase, quoting the top-up size and price shown in Clay.
- When the paid cap is spent, stop. No further purchase, plan upgrade, or second vendor is used to continue.
- The run also stops at 200 rows in a table, the free plan's limit.

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

Clay exports go to `data/georgia-sample/private/`, which is gitignored. A reduction script, not yet written, turns an export into `data/georgia-sample/people-coverage.json` and validates it against `people-coverage.schema.json` before writing. Every object in the schema forbids extra properties and no field holds free text, so a name or link cannot pass. The script also fails if any value contains an `@`, a URL, or a run of seven or more digits.

Comes back into the repository, per operator row and per site row, and nothing else:

- Identifiers already committed: `operatorId`, `ccn`, `band`, `wave`, and a status of covered, not reached, or site only.
- Per role slot: whether it was searched, how many people were found (0 to 2), whether the persona and current employment were verified, a tenure band, and a channel outcome.
- Run totals: credits, actions, dollars, run dates, and the stop reason.

Tenure is recorded as a band (under 6 months, 6 to 12, 12 to 24, over 24, or unknown), not a date. A band attached to a named facility's maintenance director could still help someone identify that person, so committing it needs the user's approval. The fallback keeps tenure bands in `private/` and commits only the resulting role-change points.

The demo may show names only to authenticated users, from the database, as decision 0007 allows. Real-person data is deleted when the project ends, including the Clay workspace tables.

## How results reach the score

No weights change. Stage 6 fills components that `tiers.json` already holds at zero as "unknown until Stage 6", plus person relevance, which has no component yet. Wiring them into `tier.ts` belongs to the session that owns it.

- `roleChange`, up to 16: from the most recent tenure band among the account's verified people. The contract leaves the decay function to the scoring milestone, so the curve is a proposal for that owner. Unknown tenure scores zero, and long tenure is never a penalty.
- Person relevance, up to 15: the highest proposed slot value among verified people at the operator or its covered sites. Taking the best person rather than a sum is a proposed rollup rule.
- `personaAndChannel`, up to 4: 2 if any verified person has persona and current employment confirmed, 2 if any of them has a validated channel.
- `engagement` stays as it is, used by the citation trigger proposal.

Each awarded point carries its input (a slot, a band, or an outcome, never a person), its source (Clay, with run date and role map version), and its freshness, as the contract requires. Rescoring with these inputs adds up to 35 points to an account's current maximum of 65, so bands should be re-inspected after Stage 6 rather than read as moving by themselves.

## Open questions for the user

1. Can a free-plan account buy a one-time top-up? Clay's docs do not say. Resolved 2026-10-20 for the case where it cannot: stay on the free plan month by month.
2. Order for bands B and C after band A: full depth per operator, or all operator rows first and sites after.
3. Persona mapping for the operations vice president and the site administrator stretches the approved personas. Approve the mapping, or add senior-living personas to the operating contract.
4. Approve the proposed person-relevance points per slot (13, 7, 10, 7) and the best-person rollup.
5. Approve committing tenure bands, or keep them in `private/` and commit only role-change points.

## Sources

Retrieved 2026-10-20.

- Clay pricing page: https://www.clay.com/pricing
- Clay University, actions and data credits: https://university.clay.com/docs/actions-data-credits
- Clay University, work email waterfall (search result only, not read in full): https://university.clay.com/docs/work-email-waterfall
