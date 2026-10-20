# Decision 0009: Account Value Model

Status: approved as drafted on 2026-10-20. Items listed under "Open within this decision" remain open and are calibrated as data arrives.

Date: 2026-10-20  
Decision owner: User  
AI role: drafted the proposal from decision 0006, the Georgia sample data, and two bounded pricing lookups

## Question

How much is an operator worth to Anchorpoint, and how does that combine with the priority score when choosing whom to work? The score in `docs/contracts/scoring-contract.md` measures timing and fit. It says nothing about size of prize. A 41-site chain and a single 60-bed home can land in the same band, and the work queue cannot yet tell whether the chain is worth the harder sale or whether the small home is worth taking because it sits next to a branch.

## Proposed decision

### Keep value separate from the score

Value is a second number beside the priority score, not more points inside it. The scoring contract is frozen at `account-score-v1.1` and deliberately rewards change propensity over static size. Folding value into it would let large chains outrank accounts with real timing evidence. Keeping the two apart lets a manager see both: how likely this account is to move now, and how much it is worth if it does.

### Site value

Each facility gets an annual value estimate. Only facilities inside the sprinkler or alarm footprint count, the same gate the tiering uses.

- Base: $9,300 a year for a median 100-bed nursing home. That is about $6,000 of recurring inspection, testing, and maintenance across the catalog lines, plus deficiency repair at $0.55 per $1 of inspection revenue from decision 0006. The $6,000 is an assumption checked against public price ranges, listed under Sources.
- Size: the base scales with certified beds raised to the power 0.7, so a 200-bed home is worth about 1.6 times a 100-bed home, not twice. Devices, heads, and systems grow more slowly than beds. Beds come from CMS (`4pq5-n9py`).
- Distance: facilities in the conditional band, 90 to 120 minutes from a capable branch, count at 75 percent to reflect travel cost to serve.

### Account value

- Annual value is the sum of the operator's serviceable site values.
- Five-year value is annual value times 4.0, which is five years at the 89 percent logo retention in decision 0006. It is not discounted, and the five-year horizon keeps an assumed retention rate from dominating the figure.
- Landing value is the five-year value of the operator's largest serviceable site. Multi-site operators are usually won one site or one region at a time, so landing value is the likely size of the first deal and full value is the ceiling.

### Effort is measured, not guessed

There is no measured win rate or sales cycle for this segment. The model does not invent one. It records two observable proxies on each operator, whether the operator is a chain with central procurement and whether a national incumbent vendor is identified, and leaves effort unscored. Win rate, cycle length, and first-deal size get measured by segment as the play runs and feed the Milestone 8 feedback loop.

### How the queue uses it

- Each operator shows a value band beside its priority band: Large at $500,000 or more of five-year value, Mid from $100,000, and Small below that.
- The queue orders by priority band first and by five-year value within a band.
- Small single-site operators in band C or Watch get rep time only if every serviceable site is within 60 minutes of a capable branch. Otherwise they wait for a later low-touch path, such as an approved email sequence, instead of taking rep time. This is the near-the-jaws rule: a small account is worth the effort only when it is cheap to win and cheap to serve.

## Illustrative results

These figures use the assumed inputs above on the 82 eligible Georgia operators from tiering proposal 2. They show the shape of the model and are not market evidence. The distance discount is not applied.

- If every serviceable site were won, the eligible footprint would be worth about $2.5 million a year, roughly 9 percent of Anchorpoint's assumed $28 million revenue.
- Value is concentrated. The five band A operators hold 51 percent of in-footprint beds, the top ten hold 64 percent, and the 61 single-site operators hold 23 percent.
- PruittHealth's 41 serviceable sites come to about $405,000 a year and $1.6 million over five years, with a landing value of about $66,000. Ethica Health comes to about $1.3 million over five years, and Empire Care Centers to about $1.1 million.
- A median single-site operator comes to about $9,000 a year and $37,000 over five years, so the largest chain is worth about 44 single sites at full value but under two at landing value.

## Rationale

The chain-versus-single-site question turns on two things this model separates. Full value says chains are worth far more. Landing value says the first win at a chain is about the size of one good single site. A chain therefore earns its harder sale through expansion, not the first deal. The near-the-jaws rule keeps small accounts from absorbing rep time unless distance and size make them cheap to win.

Beds are the only size input that is public, sourced, and present for every facility. Assumed prices stay labeled as assumptions and can be replaced by measured deal sizes later without changing the structure.

## Consequences

- `scripts/georgia-sample/tier.ts` gains annual, five-year, and landing values and a value band on each eligible operator, each with its inputs and sources.
- The scoring contract is unchanged, and value never alters a priority score or band.
- Score explanations may cite value inputs such as site count and beds, but not the assumed prices as facts.

## Open within this decision

- The $6,000 base, the 0.7 size exponent, and the 75 percent distance factor are assumptions to calibrate against real quotes or first deals.
- The value band cutoffs and the 60-minute near-the-jaws radius.
- Whether a low-touch path for small accounts belongs in Milestone 6, since it would be an activation channel.
- How effort is measured once the play runs.

## Required future tests

- Changing any value input never changes a priority score or band.
- A facility outside the sprinkler or alarm footprint contributes zero value.
- A single-site operator's landing value equals its five-year value.
- Every value carries its bed source and the version of the assumptions used.

## Sources

Retrieved 2026-10-20. Pricing sources are secondary and directional.

- Decision 0006 for assumed revenue, repair ratio, and retention: `docs/decisions/0006-ordinary-company-profile.md`
- CMS Provider Information, certified beds: https://data.cms.gov/provider-data/dataset/4pq5-n9py
- Sprinkler inspection price ranges by building size: https://fireprotectionfinder.com/guides/fire-sprinkler-inspection-cost
- Fire alarm and device inspection pricing: https://www.inspectpoint.com/?p=811
- A county contract for semi-annual alarm testing at a small adult home: https://www.warrencountyny.gov/sites/default/files/gov/resolutions/2015/07.17.2015/R347%202015.pdf
