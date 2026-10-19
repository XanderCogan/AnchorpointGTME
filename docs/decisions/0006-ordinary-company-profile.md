# Decision 0006: Ordinary-Company Operating Profile

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the profile from decisions 0003 to 0005, the TAM plan's synthetic evidence standard, and three bounded benchmark lookups

## Question

What kind of company is Anchorpoint, and what distributions should its fictional 24-to-36-month commercial history follow? The TAM plan requires an ordinary, operationally plausible company, benchmarked before any history is generated and never tuned to flatter the result.

## Evidence quality

Public benchmarks for regional fire and life-safety service companies are thin. The lookups found active private-equity consolidation and vendor-published operating figures, but no independent survey of retention, win rates, or technician productivity. Every number below is therefore labeled either sourced, meaning it is anchored to a cited public figure, or assumed, meaning it is a judgment call. Assumed values are the first to revisit if better evidence appears.

## Proposed profile

### History and ownership

- The platform is a family-founded Atlanta company, started in 1998 and acquired by a fictional growth private-equity sponsor in 2022. The fictional ownership is consistent with real sector activity: Lincoln International counted 129 fire and life-safety deals in 2023 and 109 through September 2024. Sourced for the market context; the company is fictional.
- Macon was acquired in 2023 and migrated to the field-service platform in 2025, two years after close.
- Savannah was acquired in 2024 and has not migrated. Integration slipped behind other priorities, which is common and explains its legacy systems under decision 0004.
- Greenville was acquired in 2026 and migrated at close, because the sponsor learned from Savannah.
- Salesforce was introduced at the platform in 2023, after the sponsor's acquisition. Earlier platform history exists only as imported Accounts and closed Opportunities with sparse activity.

This order matches decision 0003, where Greenville is the newest add-on, and decision 0004, where Savannah is the least integrated.

### Scale

- About $28 million in annual revenue: Atlanta $14 million, Greenville $6 million, Macon $5 million, and Savannah $3 million. Assumed, in the range of a mid-sized regional platform after three add-ons.
- About 120 field technicians, implying roughly $230,000 of revenue per technician. That sits between the vendor-reported high-performer figures of about $200,000 for extinguisher technicians and over $300,000 for sprinkler and alarm technicians, which fits an ordinary rather than exceptional company. Anchored to a vendor source.
- About 2,200 customer accounts and 5,000 serviced sites, most of them single-site customers, with a smaller number of multi-site operators carrying a disproportionate share of revenue. Assumed.

### Revenue mix

- Recurring ITM is about 55 percent of revenue, deficiency repair about 30 percent, and small projects about 15 percent. Assumed.
- Repair revenue runs at about $0.55 for every $1 of inspection revenue. A vendor describes $1 to $1 as the high-performer ratio, so Anchorpoint deliberately under-converts deficiencies. Anchored to a vendor source.
- Deficiency quotes are approved about half the time. Assumed; no public figure was found.

### Retention and expansion

- Annual logo retention of about 89 percent on recurring contracts, below the 90 to 96 percent that one sales-benchmark source calls best in class. Anchored to a vendor source.
- Net revenue retention of about 101 percent on the recurring base, just above flat. The same source treats under 95 percent as a warning sign and 102 to 108 percent as healthy. Anchored to a vendor source.
- Churn is driven mostly by price competition from an incumbent or new entrant, a champion leaving, or a facility closing or being sold. Compliance demand itself rarely disappears, because inspections are mandated. Assumed with sourced reasoning.
- Retention is weaker at Savannah and in the year after each acquisition, when customers reconsider their vendor.

### New business

- Most new business comes from referrals, inbound requests, existing-customer expansion, and inspections that surface additional sites. Structured outbound is nearly absent, which is why the first sales motion exists.
- About 25 percent of qualified new-business opportunities are won. Losses split mainly among choosing the incumbent or a cheaper competitor, no decision, timing, and unserviceable locations. Assumed.
- Median sales cycle is about 45 days for single-site opportunities and 90 to 150 days for multi-site operators. Assumed.

### Data quality by era

The history carries the CRM problems a real roll-up has, in proportion rather than for effect:

- Platform records before 2023 have sparse activity and inconsistent stages.
- Macon records were imported in bulk, with duplicate Accounts and missing owners.
- Most Savannah customers are absent from Salesforce and appear only in the legacy export.
- Greenville records are recent and comparatively clean, with some duplicates against existing Atlanta Accounts for operators served by both branches.

## Generated dataset scope

The historical fixture is a deterministic sample of the modeled company, not its full book:

- 30 months of history, from April 2024 through September 2026
- about 300 customer and prospect accounts, about 900 sites, and about 250 opportunities
- every branch represented, with multi-site operators deliberately over-sampled so parent-site reconciliation is exercised

Generation uses a versioned parameter file holding every distribution above and a recorded random seed. Parameters are fixed before generation. If the generated history suggests an ICP, that is a finding to inspect, not a reason to change the parameters.

## Rationale

An ordinary company makes the system's judgment credible. A company with excellent retention and clean data would hide the reconciliation and suppression problems the product exists to solve. A distressed one would make every recommendation look obvious. Labeling assumptions next to sourced figures lets a reviewer challenge any single number without distrusting the whole dataset.

## Consequences

- The parameter file and seed become part of the next immutable fixture release.
- ICP hypotheses drawn from this history must cite examples and stay soft under decision 0001.
- Revenue and retention figures are never presented as market evidence.

## Open within this decision

- Whether 300 accounts gives enough closed outcomes for useful ICP comparisons, which a dry run of the generator can check
- Seasonality, such as year-end inspection clustering, which is assumed absent in the first release
- Technician capacity per branch, which matters only if routing or scheduling enters scope

## Required future tests

- The same parameter file and seed always produce an identical dataset.
- Generated logo retention, win rate, and revenue mix fall within a stated tolerance of their parameters.
- Savannah customers appear mostly as field-service-only records, not Salesforce Accounts.
- No generated record falls outside the coverage or licensing rules of decision 0003 unless it is explicitly marked unserviceable.

## Sources

Retrieved 2026-10-19. Vendor and consultancy sources are directional, not independent benchmarks.

- Lincoln International, M&A activity in fire and life safety services: https://www.lincolninternational.com/perspectives/articles/ma-activity-in-fire-and-life-safety-services-continues-to-heat-up/
- ServiceTrade, fire service performance figures for technician revenue and repair-to-inspection ratio, from the results of a single search; the exact page for each figure should be confirmed: https://servicetrade.com/?p=84551 and https://servicetrade.com/resources/blog/send-more-quotes/
- Pulse RevOps, fire protection sales KPIs including renewal and net revenue retention ranges: https://pulserevops.com/industry-kpis/ik0153
