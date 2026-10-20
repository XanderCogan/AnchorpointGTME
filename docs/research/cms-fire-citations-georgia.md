# CMS Fire-Safety Citations: Georgia Nursing Homes

Retrieved: 2026-10-20  
Source: CMS Provider Data Catalog, dataset "Fire Safety Deficiencies" (ifjz-ge4w), file `NH_FireSafetyCitations_Sep2026_2.csv`, processing date 2026-09-01, catalog modified 2026-09-30. https://data.cms.gov/provider-data/dataset/ifjz-ge4w

The national file has about 200,000 citations covering the last three inspection cycles per facility. This note covers the Georgia subset and was produced by a one-off analysis script that is not yet in the repository.

## What is in the Georgia data

- 3,482 citations at 346 Georgia nursing homes, surveyed between 2018-09-27 and 2026-07-16.
- Severity is mostly low: about 65% are D (isolated, no actual harm), with the rest E and F (pattern or widespread, no actual harm).
- Almost every citation has a correction date recorded by the provider.

## Which citations Anchorpoint can fix

Tags mapped to Anchorpoint's service catalog (decision 0003):

- Sprinkler: K0353 inspection, testing, and maintenance; K0352 supervision; K0354 impairment; K0351 installation (subcontracted for large work)
- Fire alarm: K0341, K0343, K0344, K0345, K0346, K0347
- Extinguishers: K0355
- Kitchen hood suppression: K0324
- Emergency lighting and exit signs: K0291, K0293

These make up 1,224 of 3,482 Georgia citations (35%). The rest are mostly construction, electrical, doors, egress, medical gas, and staff procedure items that Anchorpoint does not do.

K0353 (sprinkler inspection, testing, and maintenance) is the single most cited Georgia tag with 454 citations. The second, K0511 electrical wiring, is not Anchorpoint work.

## Targeting results

- 312 of 346 Georgia nursing homes (90%) have at least one Anchorpoint-fixable citation in their last three inspection cycles.
- 173 have one from surveys in the last 12 months of the data.
- 157 facilities (45%) were cited for the same Anchorpoint-fixable tag at two or more separate inspections. K0353 accounts for 137 of those 230 repeat facility-tag pairs.
- 51 facility-tag pairs were cited at three or more inspections.

Repeat sprinkler-maintenance citations are the strongest signal found so far: they suggest the facility's current inspection vendor or program is not keeping it compliant.

## Correction dates measure the promise, not the fix

In Georgia the gap between survey date and correction date clusters at exactly 45 days (1,260 of 3,474 citations), with a median of 45 and 90th percentile of 53. Other states cluster on their own round numbers: Florida around 30 to 31 days, New York around 56 to 60, North Carolina around 70. The national median is 36 days.

Interpretation, which is a hypothesis and not confirmed by CMS documentation: the correction date is the date the facility commits to in its plan of correction, shaped by each state survey agency's customary deadline. It does not measure how long the physical repair took. This data therefore cannot answer how long Anchorpoint takes to fix a deficiency.

What it does establish: Georgia facilities commit to correcting within about six weeks of the inspection. Among Anchorpoint-fixable citations, only 9 of 1,224 had a correction date more than 90 days out and none more than 180 days. The 3-month payment denial and 6-month termination thresholds in 42 CFR 488.417(b) and 488.412(d) are effectively never reached for these tags in Georgia.

## Publication lag

The file processed on 2026-09-01 contains surveys only through 2026-07-16, and recent months are thin: 34 to 36 distinct Georgia surveys in March and April 2026, but 16 in May, 16 in June, and 6 in July. Surveys appear to take one to three months or more to reach the public file.

Consequence: by the time a citation appears in CMS data, the roughly 45-day correction window is often closed or nearly closed. CMS data is a targeting and history signal (who has fire-safety problems, who repeats), not a real-time trigger. A faster trigger would have to come from the Georgia state portal, which is unverified.

## Expanding the fixable set

The 35% share comes from mapping tags to the current service catalog only; it does not filter by time to fix. Adding fire door inspection (K0761), smoke barrier firestopping (K0372), corridor and smoke barrier doors (K0363, K0374), and alarm-released door hold-opens (K0223) adds 559 citations and raises the share to 51%. Those lines are not in decision 0003. The user's direction on 2026-10-20 is to self-perform inspections and subcontract repair work where specialists usually do it. A bounded search found specialty firms selling NFPA 80 fire door inspection bundled with repair and firestopping to healthcare (for example a September 2026 VA solicitation combining both), but no evidence on whether sprinkler and alarm companies usually self-perform or subcontract these lines.

## Operators behind the cited facilities

Source: CMS Provider Information file `NH_ProviderInfo_Sep2026_3.csv` (dataset 4pq5-n9py), retrieved 2026-10-20, which carries a chain name, chain ID, and national facility count per nursing home. Chain affiliation is self-reported through Medicare enrollment and can stop at a single-building LLC, so each mapping needs confirmation against the operator's own website.

- Georgia has 356 nursing homes in the file: 248 in 28 chains and 108 independent.
- The 312 facilities with fixable citations resolve to 28 chains (215 facilities) and 97 independents, so about 125 operator accounts rather than 312.
- By national chain size, the 215 chained facilities split into 93 in chains of 50 or more, 80 in chains of 11 to 49, and 42 in chains of 2 to 10.
- Two operators hold most of the chained volume: PruittHealth (49 cited Georgia facilities of 60, 96 nationally) and Ethica Health (40 of 50).
- Mid-size regional chains with high repeat rates include Journey Healthcare (13 of 20 cited facilities show repeats), Harborview Health Systems (7 of 11), Beacon Health Management (6 of 10), and Empire Care Centers (5 of 18).
- Large national chains have few Georgia facilities, for example Life Care Centers of America (3) and Life Care Services (2). Life Care Services runs a group purchasing program that lists a national fire-protection vendor, which supports the hypothesis that national chains are harder to win.
- Ownership type is mostly for-profit LLC (130) and for-profit corporation (78), with 75 nonprofits.
- Only one cited facility changed ownership in the last 12 months.
- Median size is 100 certified beds.

## Georgia state inspection portal

Checked in the browser on 2026-10-20: the Georgia DCH Healthcare Facility Regulation inspection report search at https://weblink.dch.georgia.gov/WebLink/CustomSearch.aspx?SearchName=InspectionReportSearch&repo=WEB is public without sign-in. It covers over 24,000 surveys from the past three years across facility types including nursing homes, assisted living communities, and personal care homes. Each result lists address, administrator name, licensed beds, citation count, survey type, and whether a violation was found.

Reports appear fast: on 2026-10-20 the newest nursing home result was a survey dated 2026-10-19. That makes the state portal a possible real-time trigger where CMS is not.

Fire-safety findings are mostly not here. Checked 2026-10-20: the reports are scanned state licensure surveys citing Georgia rules (for example 111-8-50 for nursing homes), not federal Life Safety Code K-tags. Report text is searchable, but a search for "sprinkler" across assisted living community surveys dated 2026 returned a single document. Fire inspections for these facilities appear to sit with the State Fire Marshal or local fire marshals, which this portal does not cover.

Consequence: the state portal is a fast source for facility facts, administrator names, and licensure problems, but not a real-time fire-safety trigger. CMS remains the fire-safety signal, with its publication lag. Fire marshal inspection records are the remaining candidate for a fast trigger and are unresearched.

## Open follow-ups

- Confirm with CMS or Georgia survey agency documentation how the correction date is set.
- Find whether Georgia State Fire Marshal or local fire marshal inspection records are public and how quickly.
- Confirm each operator mapping against operator websites before tiering.
