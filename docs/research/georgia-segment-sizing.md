# Georgia Coarse Segment Sizing

**Status:** First pass, 2026-10-21. Order-of-magnitude only. Counts are statewide and not yet filtered to the branch footprint in decision 0003. Implements "Segment sizing" in `tam-construction-plan.md`.

## Method

One public source covers every segment on the same basis: the U.S. Census Bureau County Business Patterns 2023 state file (`cbp23st.zip`, https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23st.zip, retrieved 2026-10-21), Georgia rows, all legal forms of organization. For each industry code it gives establishments and the number with 20 or more employees. Registry counts are added where one exists.

Rules for reading these numbers:

- An establishment is a business location, not a building and not an operator account. Accounts are fewer wherever chains, systems, or management companies own many sites.
- County Business Patterns excludes most government employers, so public schools and public hospitals are undercounted or missing.
- The 20-plus-employee count is used as a rough proxy for a site large enough to carry a sprinkler or monitored alarm system. That proxy is an assumption, not a fact.
- Calibration check: Census counts 455 Georgia nursing-care establishments (NAICS 623110), while the CMS Provider Information file lists 356 certified nursing homes. Census runs about a quarter above the registry here, so treat its counts as ceilings.

## Sourced counts and signals by segment

### 1. Senior living and skilled nursing (worked first)

- Nursing homes: 356 CMS-certified facilities resolving to about 136 operator accounts (`georgia-senior-living-sample-plan.md`, CMS `4pq5-n9py`). Census: 455 establishments, 333 with 20-plus employees.
- Assisted living for the elderly (623312): 538 establishments, 254 with 20-plus. Continuing care retirement communities (623311): 100, 69 with 20-plus.
- Order of magnitude: about 1,000 sites, a few hundred operator accounts.
- Public need signal: CMS Life Safety Code K-tag citations, dated and facility-level (`cms-fire-citations-georgia.md`). No equivalent public fire data was found for assisted living or personal care homes.

### 2. Healthcare (hospitals)

- General and specialty hospitals (622): 206 establishments, 190 with 20-plus. Public hospitals are partly excluded, so the true site count is somewhat higher.
- Order of magnitude: about 200 sites, held by a few dozen health systems.
- Public need signal: hospitals are surveyed against the same Life Safety Code, but whether Georgia hospital K-tag citations are published at facility level was not checked in this pass.

### 3. Education (K-12)

- Private elementary and secondary schools (6111): 715 establishments, 394 with 20-plus.
- Public schools: GaDOE's 2021-22 Quick Facts reported 2,306 schools in 219 school systems. This figure came from a search-result excerpt; the GaDOE page returned 404 on direct fetch on 2026-10-21, so it is unverified and dated.
- Order of magnitude: about 3,000 sites, but only about 200 public buying entities (districts) plus private schools.
- Public need signal: none statewide found. Districts buy through public bids, which are observable but are not a fire-condition signal.

### 4. Multifamily

- Residential property managers (531311): 1,776 establishments, 106 with 20-plus. Lessors of residential buildings (531110): 1,939, 51 with 20-plus.
- Census counts firms here, not apartment communities, so the building count is unknown from this source. The account is the management company; the sites are its portfolio.
- Order of magnitude: low thousands of firms, of which perhaps a hundred or two manage portfolios large enough to matter.
- Public need signal: none statewide; fire inspection records sit with local fire marshals.

### 5. Commercial and industrial property

- Manufacturing (31-33): 7,874 establishments, 2,694 with 20-plus.
- Warehousing and storage (493): 1,037 establishments, 428 with 20-plus.
- Nonresidential property managers (531312): 534, 41 with 20-plus. Lessors of nonresidential buildings (531120): 1,055, 42 with 20-plus.
- Order of magnitude: about 3,000 industrial sites with 20-plus employees, mostly single-site or few-site owners in Georgia; commercial office buildings are not counted by this source.
- Public need signal: OSHA publishes establishment-level inspection and citation data, which includes fire-protection standards. Coverage for Georgia was not checked in this pass.

### 6. Hospitality (from the Georgia-first source plan)

- Hotels and motels (721110): 2,157 establishments, 563 with 20-plus.
- Order of magnitude: about 2,000 properties, with management companies and brands as the parent layer.
- Public need signal: the Georgia DPH tourist-accommodation inspections cover sanitation, not fire systems, so no public fire signal.

## Assumptions about value per site

These are labelled assumptions, not sourced facts, and are not yet versioned in a decision. Only the skilled nursing base comes from decision 0009.

- Skilled nursing: $9,300 a year for a 100-bed home, scaled by beds to the power 0.7 (decision 0009).
- Assisted living and CCRCs: assumed about half to equal the nursing-home base, since buildings are often smaller but similarly regulated.
- Hospitals: assumed three to five times the nursing-home base per site, for larger buildings and more systems.
- K-12 schools, multifamily communities, hotels, and industrial sites with 20-plus employees: assumed roughly $3,000 to $8,000 a year per site, mainly inspection and testing.

## Ranking of the other segments

Scope: senior living and skilled nursing is the one segment this project drills into. The ranking below is market context for a client conversation about where to go next. It does not plan any work or spend on a second segment.

If a second segment were chosen, industrial (manufacturing and warehousing sites with 20-plus employees) would rank first, with hospitals as a cheap follow-on to the senior-living work.

- It has the largest serviceable site count, around 3,000, several times the senior-living universe.
- It is the only other segment with a likely dated, facility-level public need signal (OSHA citations), which mirrors what made CMS K-tags useful. This must be confirmed with one bounded check before any enrichment spend.
- Buying is mostly at site or regional level, which fits a regional contractor better than centralised procurement.
- Hospitals are the fallback: few sites, high value per site, likely the same Life Safety Code evidence, but concentrated in health systems that probably use national vendors, as the senior-living work found for large chains.
- Education, multifamily, and hospitality are deferred: no public fire signal, and their buying entities (districts, management companies, brands) need parent resolution before sizing means much.

## Open items if a second segment is ever chosen

- Filter all counts to the decision 0003 branch footprint before comparing value.
- Confirm OSHA fire-protection citation coverage for Georgia sites, and whether CMS publishes hospital K-tags.
- Replace the public school figure with a current GaDOE count.
