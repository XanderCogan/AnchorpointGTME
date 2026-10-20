# Decision 0003: Service Catalog, Branch Footprint, Licensing, and Travel Time

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open. Amended on 2026-10-20 to add subcontracted large sprinkler work and fire door and firestopping lines.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the proposal from the TAM construction plan, the `inspection-v1` account geography, and two bounded licensing lookups

## Question

What does Anchorpoint sell, from where, under which licenses, and how far can a technician reasonably drive? TAM construction step 6 cannot apply serviceability until these rules exist, and the historical dataset cannot record serviceability evidence without them.

## Proposed decision

Anchorpoint is an ordinary regional fire and life-safety service company. Most of its revenue comes from recurring inspection, testing, and maintenance (ITM), and its project work comes mostly from deficiencies found during inspections. It is not a new-construction design-build sprinkler contractor, and it does not sell security or access control.

### Service catalog

Recurring service lines:

- Water-based sprinkler and standpipe inspection, testing, and maintenance under NFPA 25
- Fire alarm inspection and testing under NFPA 72
- Portable fire extinguisher service under NFPA 10
- Commercial kitchen hood suppression service under NFPA 17A and NFPA 96
- Emergency and exit lighting testing under NFPA 101
- Fire alarm monitoring, resold through a third-party UL-listed central station rather than operated in-house

Project and one-time lines:

- Deficiency repair identified during inspection
- Small tenant-improvement sprinkler and alarm modifications
- Device and panel replacement or retrofit

Added 2026-10-20:

- Fire door inspection and testing under NFPA 80, self-performed from the Atlanta and Macon branches
- Smoke barrier and firestopping inspection, self-performed from the same branches
- Fire door, smoke door, hold-open device, and firestopping repairs, subcontracted to specialists with Anchorpoint keeping the customer

Subcontracted: sprinkler work too large for the catalog, such as adding coverage to an unsprinklered wing, is subcontracted to a licensed installer while Anchorpoint keeps the customer relationship and manages the job. This keeps cited customers from going to a competitor. Added 2026-10-20.

Explicitly excluded from self-performed work: new-construction sprinkler design-build, special-hazard clean-agent systems, backflow testing, and security or access control. Excluded lines stay visible in the market model as evidence about an account but never qualify it.

### Licensing constraints

A service line is serviceable in a state only when Anchorpoint holds the matching license there. Licensing is a hard serviceability gate, independent of drive time.

In Georgia, the proposal assumes Anchorpoint holds:

- a fire protection sprinkler contractor certificate from the Office of Insurance and Safety Fire Commissioner, with licensed fire protection system inspectors for ITM work (Ga. Comp. R. & Regs. 120-3-19);
- a portable fire extinguisher and fire suppression system company license from the same office, with permitted technicians (Ga. Comp. R. & Regs. 120-3-23); and
- a low-voltage contractor license for alarm work (Class LV-A or LV-U) from the Secretary of State's Construction Industry Licensing Board.

South Carolina licenses are assumed held for the Greenville branch's service lines. North Carolina licenses are not held. The SC and NC licensing regimes have not been researched; the specific SC license names remain open until a later bounded lookup.

### Branch footprint

Anchorpoint is a platform company with three add-on acquisitions, which produces realistic acquisition-era inconsistencies in capability and data:

- Atlanta metro (Norcross), the platform branch: every catalog line
- Macon, an add-on: every recurring line except fire alarm monitoring resale, which still runs through the acquired company's legacy central-station contract
- Savannah, an add-on that came from an extinguisher and kitchen-hood shop: extinguisher, kitchen hood, and emergency lighting only; no licensed sprinkler inspector yet
- Greenville, South Carolina, the newest add-on: sprinkler ITM, fire alarm ITM, and extinguisher service

Branch city and capability choices are fictional company facts. Their plausibility will be benchmarked in the later ordinary-company profile decision and may change there.

### Travel-time rules

Serviceability uses estimated one-way drive time by road from the nearest branch that offers the needed service line, not straight-line radius.

- Up to 90 minutes: serviceable for every line the branch offers.
- From 90 to 120 minutes: conditionally serviceable. The record carries a route-density reason, such as a multi-site parent with nearby sites, and needs manager approval before activation.
- Over 120 minutes: not serviceable from that branch.
- Emergency or same-day service is promised only within 60 minutes.

The conditional band avoids a hard cliff at 90 minutes, consistent with decision 0001. The 120-minute ceiling is a hard serviceability gate because a technician physically cannot cover work beyond it profitably.

## Rationale

ITM-led service is the common shape of regional fire and life-safety companies and matches the TAM plan's emphasis on recurring compliance work. Separating license gates from drive-time gates lets the system explain why a site is unserviceable: a site can be near a branch and still unserviceable because the branch lacks a capability or license. The Savannah sprinkler gap and the absence of North Carolina licenses are deliberate. They create inspectable serviceability decisions without inventing data contradictions.

## Consequences

- North Carolina accounts in `inspection-v1` and later fixtures remain in the market model as not serviceable because of licensing, not distance.
- Savannah-area sprinkler opportunities are not serviceable until a capability change is recorded.
- Facility records need a nearest-capable-branch reference, estimated drive time, the time source and date, and the serviceability state with its reason.
- The later Georgia segment sample decision must fall inside these coverage areas.
- The historical dataset must reflect the catalog: mostly recurring ITM contracts, with project revenue tied to deficiencies.

## Open within this decision

- The source of drive-time estimates (a routing API or a precomputed isochrone) and its cost
- The South Carolina license names and holders
- Whether emergency lighting and monitoring resale count as standalone service lines or as attachments to alarm ITM

## Required future tests

- A site 85 minutes from a capable branch is serviceable, one at 95 minutes is conditional with a recorded reason, and one at 125 minutes is not serviceable.
- A North Carolina site within 90 minutes of Greenville is not serviceable, and its reason names licensing.
- A Savannah-area sprinkler site is not serviceable from Savannah and falls back to the nearest capable branch's drive time.
- An excluded service line never raises an account's eligibility.

## Sources

Retrieved 2026-10-19.

- Georgia rules for the fire sprinkler act, 120-3-19: https://rules.sos.ga.gov/gac/120-3-19
- Georgia rules for portable extinguishers and suppression systems, 120-3-23: https://rules.sos.ga.gov/gac/120-3-23
- Georgia Office of Insurance and Safety Fire Commissioner, fire suppression licensing: https://oci.georgia.gov/node/1346
- Georgia Secretary of State, Board of Low Voltage Contractors FAQ: https://sos.ga.gov/page/board-low-voltage-contractors-faq
