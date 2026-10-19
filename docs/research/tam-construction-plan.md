# Anchorpoint TAM Construction Plan

**Status:** Proposed discovery plan. Company-specific assumptions require confirmation.

## Purpose

Construct a defensible serviceable market for Anchorpoint Fire & Safety from historical customer evidence and external market sources. Preserve parent, site, contact, source, and confidence relationships so the resulting universe can support account-based selling, enrichment, and routing.

## Core distinction

Historical customer and opportunity data helps identify an ICP. External market research constructs the TAM. The work is iterative: early ICP hypotheses guide sourcing, and inspection of the resulting market can reveal that the initial hypotheses were incomplete.

For Anchorpoint, the market cannot be represented by a flat lead list. The model needs parent operators, regional or brand entities where relevant, physical facilities, installed-system context, and buying contacts.

## Synthetic evidence standard

Anchorpoint's internal customer, deal, service, billing, renewal, and churn history is fictional, but it must not be free-form generated filler. Before producing the historical dataset, define a benchmark model from public evidence about comparable regional fire and life-safety service companies and growth private-equity-backed operators.

Model Anchorpoint as a deliberately ordinary, operationally plausible company: neither distressed nor exceptional, neither perfectly clean nor conveniently chaotic, and without growth, win rates, retention, or outbound results selected to flatter the application. Establish the following assumptions before generating records:

- platform and acquired-company age;
- branch footprint, licensing, technician capacity, and travel-time coverage;
- service and customer mix;
- plausible account, facility, contact, and activity volumes;
- contract values, sales-cycle lengths, stage conversion, and loss distributions;
- renewal, expansion, and churn behavior; and
- acquisition-era CRM and operating-system inconsistencies.

Use real companies, facilities, domains, parent-site relationships, and other sourced public facts when constructing the external market. Anchorpoint's customer relationships, opportunities, commercial outcomes, ownership, and activity history may be fictional. Keep one project-level disclosure of that distinction; row-by-row simulation labels are not required for this private portfolio exercise.

Record the benchmark sources, assumptions, generation method, and random seed where applicable. Do not treat synthetic distributions as market evidence, and do not tune the generated history to produce a predetermined ICP, score ranking, or success story.

## Historical discovery dataset

Use 24 to 36 months of closed-won, closed-lost, customer, service, renewal, expansion, and churn history. Reconcile CRM records with field-service, invoicing, or ERP records before treating commercial outcomes as truth.

Required fields include:

- Canonical parent and physical facility identifiers
- Anchorpoint branch and serviceability evidence
- Vertical and facility type
- Number of serviceable locations
- Fire systems present
- Service lines purchased
- Recurring contract value
- One-time project value
- Deal outcome and dates
- Sales-cycle length
- Incumbent provider
- Trigger that created the opportunity
- Buying personas involved
- Won or lost reason
- Lead source
- Renewal, expansion, and churn outcomes
- Field provenance, confidence, and freshness

Do not infer the ICP from the existing `inspection-v1` fixture. It contains one closed-won deal and deliberate data contradictions built to test audit rules.

## ICP hypotheses

Analyze outcomes without imposing hard cutoffs. Compare patterns across:

- Parent and site footprint
- Facility type and regulatory context
- Branch coverage and travel time
- Fire-system and service-line mix
- Recurring versus project revenue
- Buying role and functional influence
- Incumbent-provider context
- Trigger events
- Sales-cycle duration
- Win and loss reasons
- Renewal and expansion behavior

The output should be inspectable statements supported by examples. A hypothesis might say that multi-site operators with fragmented inspection schedules expand more often, or that a new regional facilities leader correlates with vendor review. It must not claim causation or create a sharp eligibility boundary without evidence.

## Georgia-first source plan

### Senior living and healthcare

- Georgia GaMap2Care licensed-facility data
- CMS provider and facility data
- LeadingAge Georgia provider directory
- Georgia Health Care Association directory
- Operator and facility websites

### Hospitality

- Georgia Department of Public Health tourist-accommodation inspection search
- Georgia Hotel and Lodging Association sources
- Hotel management-company portfolios
- Brand location pages
- Google Maps

### Commercial property management

- Property-management company portfolio pages
- BOMA Georgia where directory access permits
- Commercial-property data sources where available
- County property and building records
- Google Maps

### Industrial

- Georgia manufacturing and exporter directories
- EPA facility data
- Industrial-park and economic-development directories
- Company location pages
- Google Maps

### Competition and incumbent context

- Georgia Safety Fire licensed-professional search
- Contractor and trade-association directories
- Company service-area and capability pages

Licensed contractor data describes the service-provider market. It is useful for competitor and incumbent research but is not itself the customer TAM.

## Construction workflow

1. Collect candidate physical facilities from multiple relevant sources.
2. Preserve the source record and extraction date.
3. Normalize facility identity and address.
4. Resolve facilities to brand, regional operator, and ultimate operating parent.
5. Deduplicate without merging legitimately separate sites or subsidiaries.
6. Apply Anchorpoint branch, licensing, service-line, and travel-time coverage.
7. Remove known customers and accounts with active opportunities from net-new activation while retaining them in the market model.
8. Enrich the remaining accounts progressively.
9. Find likely buying roles and verified channel data.
10. Apply versioned ICP hypotheses, change signals, and data-confidence rules.
11. Present the ranked population in the interactive play table.
12. Require human approval before Lemlist or TitanX activation.

## Enrichment levels

### Universe-level identity

Run across the full candidate universe:

- Canonical name and domain
- Parent and site relationships
- Address, geography, and serviceability
- Vertical and facility type
- Customer and opportunity status
- Basic contactability

### Commercial qualification

Run on the plausible serviceable subset:

- Location footprint
- Fire-system and service-line context
- Evidence of fragmented vendors or schedules where discoverable
- Incumbent-provider evidence
- Relevant buying committee
- Source-backed operational need

### Signals

Run only when relevant to the approved play:

- Relevant role change
- Acquisition or ownership change
- New facility, region, or expansion
- Facilities, safety, compliance, or procurement hiring
- Permits or projects
- Conference attendance or verified engagement

### Deep account research

Reserve for the highest-priority accounts:

- Detailed buying committee
- Current initiatives
- Messaging hypothesis
- Likely objections
- Mutual connections
- Recommended email or call approach
- Human-reviewed evidence

## Output model

Report at least three distinct counts:

- Candidate facilities discovered
- Serviceable parent accounts after resolution and coverage rules
- Relevant contacts with usable evidence

Keep customers, active opportunities, duplicates, and incomplete records visible in the market model with explicit states. Do not erase them merely because they are ineligible for net-new activation.

The first application fixture remains approximately 200 companies and 600 contacts. Production-scale estimates remain provisional until the Georgia sample is sourced, resolved, and filtered by serviceability.

## Open decisions

- Service catalog, branch locations, travel-time rules, and licensing and capability constraints are resolved in `docs/decisions/0003-service-catalog-and-footprint.md`
- The field-service source system and its reconciliation with the Salesforce CRM are resolved in `docs/decisions/0004-operating-source-system.md` and `docs/decisions/0005-crm-system-of-record.md`
- Anchorpoint platform age, acquired-company history, operating profile, and historical dataset parameters are resolved in `docs/decisions/0006-ordinary-company-profile.md`
- Which segments belong in the first Georgia sample
- Which enrichment vendors and credits are acceptable
- Which signals deserve ongoing monitoring
- Which role owns the play table and approval workflow

## Acceptance criteria

- Every facility retains its source and extraction date.
- Every parent-site relationship is inspectable.
- Serviceability has explicit evidence.
- Unknown data remains unknown rather than becoming a negative fact.
- ICP traits influence priority gradually.
- Customers, open opportunities, suppressions, and unresolved identities cannot enter activation.
- Every score and proposed action shows its inputs, freshness, and rule version.
- The user can explain how one account moved from raw facility source to parent account, buying contact, rank, and proposed action.
