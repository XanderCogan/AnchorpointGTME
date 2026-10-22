# Decision 0007: First Georgia Segment Sample and Enrichment Budget

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open. Amended on 2026-10-19: the user cut the enrichment budget from a $300 cap to $0, free tiers only. Amended on 2026-10-20: the user set the budget to $20 for Clay and $20 for one other service. Amended again on 2026-10-20: the project runs in one day, and the user will pay beyond the $20 Clay cap rather than wait for monthly free credits; each purchase is still confirmed with the user at the price shown.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the proposal from the TAM construction plan, decisions 0003 and 0006, and three bounded source and pricing lookups

## Question

Which segment does the first real Georgia market sample cover, which sources build it, and how much enrichment spend is acceptable? This is the first step of the data foundation: map the accounts, find the people, enrich and validate, then tier and load.

## Proposed decision

### Segment: senior living and skilled nursing

The first sample covers senior-living and skilled-nursing operators in Georgia: nursing homes, assisted living communities, and large personal care homes.

Reasons, in order of weight:

- **The data is public and authoritative.** Federal and state regulators publish facility lists with addresses, bed counts, and operator relationships. That makes the parent, operator, and site model in the TAM plan testable with real records rather than guesses.
- **Fire safety is regulated and inspected.** Nursing homes receive federal life-safety code surveys, and the results are public. A facility recently cited for fire safety deficiencies is a source-backed reason to talk, which fits the change-propensity approach in decision 0001.
- **The segment is multi-site.** Regional operators run many facilities, which is where fragmented inspection schedules and vendor sprawl live, matching the first sales motion in the operating contract.
- **The buyers are identifiable by role.** Regional maintenance or facilities directors and operations vice presidents sit at the operator, while executive directors and maintenance directors sit at each site.

Hospitality, commercial property management, and industrial follow as later samples once this method is proven.

### Geography

Facilities inside the decision 0003 coverage areas, meaning within 120 minutes of a branch able to perform the needed service. Atlanta and Macon carry the full catalog. Savannah-area facilities stay in the sample but are not serviceable for sprinkler work, which exercises the capability gate on real records.

### Size and stopping rule

The target is the TAM plan's first application fixture: about 200 operator accounts and 600 contacts, drawn from however many facilities it takes to reach them. The sample stops at that size even if more facilities remain. The point is to prove the method and measure match and coverage rates, not to finish the market.

### Sources by enrichment level

Universe-level identity, run across every candidate facility, uses free sources first:

- CMS nursing home provider data, including ownership and affiliated-entity fields, which needs confirming
- CMS fire safety deficiency data for life-safety survey citations, which needs confirming
- Georgia GaMap2Care for state-licensed assisted living and personal care homes. It is a search tool with no confirmed bulk export, so collection needs a small, polite scraper or an open-records request to the Department of Community Health. Resolved on 2026-10-19: GaMap2Care appears retired, and the user chose a scraper of its replacement public search, subject to that site's terms of use. No records request is sent.
- Operator websites for facility lists and parent relationships
- Serper search to find operator domains and confirm parent-site links

Commercial qualification, run on the serviceable subset, uses operator websites and job postings found through Serper. Maintenance-director and facilities hiring, new communities, and acquisitions feed the tier.

People and channel data, run only on qualified accounts, uses Clay: find people by role at the operator and its sites, scrape operator leadership pages where people are not on LinkedIn, and measure email-verification rates on a capped subset.

Signals for ongoing monitoring are limited to fire safety citations, relevant role changes, and ownership changes. Monitoring cadence is left to the signal milestone.

### Budget

- The cap is $40: up to $20 on Clay and up to $20 on one other service of the project's choice. Public data and free tiers are used first, and paid spend starts only when a free tier runs out. Each purchase is confirmed with the user before it is made.
- Serper: the free allowance first, spent on operator domains and parent-site confirmation, then on job postings if allowance remains.
- Clay: the free plan first, to prove the table design, then up to $20 of paid credit for the people pass on qualified accounts. Phone enrichment is excluded. Amended 2026-10-20: because the project runs in one day, Clay spend may exceed $20 when the free plan cannot finish the pass, up to the cheaper of the needed top-ups or one Launch month, confirmed with the user before purchase. The plan is in `docs/research/georgia-clay-people-pass.md`.
- The second $20 is unassigned. It goes to whichever single service the build shows needs it most, such as more search queries or email verification, and the choice is recorded here when made.
- When a free tier and its paid cap are both used up, the sample stops that pass and reports how many accounts it covered, rather than spending more. A smaller people pass with honest coverage rates is an acceptable result.
- Bulk database exports from contact-data vendors are excluded. The method is the point.

Free-tier limits come from secondary sources and must be confirmed on each vendor's own pricing page before relying on them.

### Personal data boundary

The market sample contains real people. The safety rules already forbid contacting anyone, and this decision adds limits on what is stored:

- Business facts about facilities and operators may be committed to the repository with their source and retrieval date.
- Personal names, titles, and profile links stay out of version control. They live only in the Clay workspace and the local or deployed database, and the demo interface may show them only to authenticated users.
- Email addresses and phone numbers are never committed. Amended on 2026-10-22 under decision 0012: work emails are stored in Attio as part of People records and shown only to authenticated users. The original sample recorded only whether a verified channel existed.
- Real-person data is deleted when the portfolio project ends.

## Rationale

Senior living and skilled nursing offer the rare combination of public, authoritative facility and operator data with public fire safety evidence. That lets the first sample show the whole method on real records: facility to operator, operator to tier, tier to buyer. A deliberately small budget and stopping rule show the judgment the method is meant to demonstrate. Picking shots is the point, and spend that is not needed is waste.

## Consequences

- The first market fixture is senior-living-shaped. Facility, Site, and Account records follow the Salesforce mapping in decision 0005.
- The play's personas gain senior-living role titles, such as regional maintenance director and executive director, mapped to the existing approved personas.
- Measured match, verification, and coverage rates become inputs to estimating the cost of later segments.

## Open within this decision

- Confirming the CMS ownership and fire safety deficiency dataset fields, with one bounded lookup each when the build starts
- Whether the repository is public, which affects how strictly the personal data boundary must be enforced in fixtures and screenshots

## Required future tests

- Every facility record carries its source and retrieval date.
- A facility cited for a fire safety deficiency shows the citation as evidence on its account.
- No committed fixture or artifact contains an email address or phone number belonging to a real person.
- A Savannah-area facility is serviceable for extinguisher work and not for sprinkler work.
- The sample stops at its target size and reports how many facilities remained unprocessed.

## Sources

Retrieved 2026-10-19. Pricing sources are secondary and directional.

- Clay pricing summary after the March 2026 credit change: https://www.zeliq.com/blog/clay-pricing
- Serper pricing and credit rules: https://apiserpent.com/blog/serper-pricing-credits-explained
- GaMap2Care description and facility search: https://aging.georgia.gov/faqs
- Georgia assisted living definition and regulation summary: https://publish.ahcancal.org/Assisted-Living/Policy/2019%20State%20AL%20Reg%20Summaries/Georgia.pdf
