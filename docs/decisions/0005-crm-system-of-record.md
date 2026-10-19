# Decision 0005: Salesforce as the CRM System of Record

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the proposal after mapping where HubSpot is assumed in the contracts, code, and fixture

## Question

Should Anchorpoint's CRM remain HubSpot, as the approved contracts and `inspection-v1` assume, or move to Salesforce before the historical dataset and market model are built?

## Proposed decision

Salesforce becomes Anchorpoint's CRM system of record for all work after Milestone 2.

Milestone 2 stays as built and accepted. `inspection-v1` remains an immutable HubSpot-shaped audit release, and the deployed application keeps working against it. Every later fixture release, contract revision, and connector targets Salesforce.

The core audit and scoring model stays CRM-neutral. Salesforce-specific names live in a mapping layer, so the rules reason about accounts, sites, contacts, opportunities, owners, consent, and activities rather than provider objects.

### Object mapping

- The parent operator and regional operating entities become Accounts, linked through the standard parent-account hierarchy.
- Physical facilities become a custom Site object related to their operating Account. A site is serviced but is not a buying entity, so keeping sites out of the Account object keeps account counts and tiering honest.
- Buyers and influencers become Contacts on Accounts. The full people universe from TAM construction loads as Contacts, not Leads, because work is account-based.
- Leads are used only for inbound hand-raisers that cannot yet be matched to an Account. They are matched and converted, or held for review, before any follow-up.
- Opportunities replace deals, with record types or separate stages standing in for HubSpot pipelines.
- Users replace HubSpot owners. Every activated contact still needs a named accountable owner.
- Tasks and Events replace activities.
- Campaigns and Campaign Members replace HubSpot lists and segments for controlled activation audiences.
- Email opt-out and do-not-call fields on Contact and Lead carry suppression signals. Deny-first suppression is unchanged.

### Development environment

The read-only connector milestone uses a free Salesforce Developer Edition org loaded only with synthetic data. No production org or real customer data is involved.

## Rationale

Private-equity-backed operating companies with acquisition histories commonly run on Salesforce, and Apero's work spans both CRMs. Switching now is cheap: only `inspection-v1`, its audit rules, and the contract language assume HubSpot, and the TypeScript model is already mostly provider-neutral. Switching after the 24-to-36-month synthetic history exists would mean regenerating that history and its reconciliation.

Salesforce's parent-account hierarchy and custom objects also fit the parent, operator, and site model in the TAM plan better than a flat company list.

## Rejected alternatives

Staying on HubSpot was rejected because the target clients are more likely to run Salesforce. Supporting both CRMs equally was rejected because two live connectors would double integration and verification work without adding product insight. The neutral core model keeps a future HubSpot adapter possible.

## Consequences

When this decision is approved, the following owning documents are revised in a follow-up change, not silently:

- `docs/contracts/operating-contract.md`: CRM source of truth, current-customer property, ownership, and connector write limits
- `docs/contracts/activation-state-machine.md`: the phone handoff becomes a controlled Campaign rather than a HubSpot segment
- `docs/contracts/health-rule-catalog.md`: owner and consent wording
- `docs/product/architecture.md` and `docs/product/build-plan.md`: Milestone 3 becomes a read-only Salesforce connection
- `docs/product/brief.md`: CRM references

Other effects:

- Decision 0004 reconciles the field-service platform with Salesforce Accounts and Sites.
- The audit rules gain a Salesforce mapping and new tests. The existing `inspection-v1` tests remain unchanged and keep passing.
- The proposed Supabase database change is not part of this decision. Railway PostgreSQL stays until a separate infrastructure decision.

## Open within this decision

- Whether Sites use a custom object or Salesforce Field Service's Location object. The custom object is simpler and does not require a Field Service license.
- Confirming that the planned TitanX and Lemlist integrations support Salesforce as expected, through one bounded lookup each.
- Whether opportunity types use record types or a single pipeline with type fields.

## Required future tests

- A Salesforce-shaped fixture reproduces each `inspection-v1` finding category through the mapping layer.
- An inbound Lead that matches an existing Account is linked to it and inherits its suppression state before follow-up.
- An unmatched Lead cannot enter activation.
- A Contact with email opt-out never enters an email Campaign.
- A Site never counts as a separate Account in tiering totals.
