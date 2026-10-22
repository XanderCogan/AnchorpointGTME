# Operating Contract

Status: approved and amended after Milestone 1 review on 2026-10-17; amended on 2026-10-19 for decisions 0003, 0004, and 0005; amended on 2026-10-21 for decision 0011, which replaces Salesforce with Attio.

Frozen version: `operating-contract-v1.3`

Version `v1.2` named HubSpot as the CRM and remains the governing contract for the immutable `inspection-v1` fixture and the accepted Milestone 2 application. Version `v1.3` governs every later fixture release, connector, and milestone.

## Fictional portco

Anchorpoint Fire & Safety is a fictional private-equity-backed commercial fire and life-safety services company. It performs recurring inspection, testing, maintenance, and repair for multi-location commercial operators from branches in Georgia and South Carolina. Its service catalog, branches, licensing gates, and travel-time rules are defined in `docs/decisions/0003-service-catalog-and-footprint.md`. North Carolina operators appear in the CRM but are not serviceable because Anchorpoint holds no North Carolina licenses.

The company recently consolidated several local operators. Its CRM contains imported records, inconsistent ownership, duplicated companies, stale deals, and contacts without clear personas. Leadership wants to add structured outbound without contacting customers, duplicating active opportunities, or handing representatives unusable lists.

## First sales motion

The first play targets multi-location commercial operators within Anchorpoint's service area. The offer is a working session to assess fragmented inspection schedules, vendor coverage, and compliance risk across locations.

The initial target segments are:

- Senior-living operators
- Regional healthcare groups
- Hospitality groups
- Industrial property operators
- Commercial property-management firms

The initial buying personas are:

- Vice President or Director of Facilities
- Director of Property Operations
- Environmental Health and Safety leader
- Compliance or Risk leader with facilities responsibility
- Regional Facilities Manager

Provisional senior-living personas, added on 2026-10-20 for the Georgia sample. **Review later:** keep, rename, or remove each one, and remove any generic persona above that does not fit, once Stage 6 shows which job titles actually exist at Georgia nursing-home operators. Until then, contacts mapped to these personas count as mapped for scoring but are marked provisional.

- Senior-Living Operations Leader: a regional or corporate vice president or director of operations who oversees several facilities' administrators, budgets, and vendors
- Site Administrator: the licensed nursing home administrator or executive director accountable for one facility's surveys, budget, and vendors

## Systems of record

Attio is the operational source of truth for CRM identity, ownership, lifecycle, opportunity state, consent, and activity. The object mapping is defined in `docs/decisions/0011-attio-crm-system-of-record.md`: Companies linked by a parent-company reference, a custom Site object for physical facilities, People, Deals, workspace members as owners, Tasks and Notes, and Lists for controlled audiences. How unmatched inbound hand-raisers are held is open under that decision. The application keeps a versioned, CRM-neutral mirror for audits and processing but does not become the sales team's primary CRM.

The field-service management platform is the source of truth for service delivery, contracts, invoices, and therefore customer status, as defined in `docs/decisions/0004-operating-source-system.md`. Where it disagrees with Attio, the disagreement is a reconciliation finding rather than a silent override.

Clay supplies enrichment with field-level provenance. Enriched values are proposed inputs until they pass validation and, where required, human review.

Lemlist is the email execution system. TitanX is the calling execution system. The application owns eligibility, approval evidence, idempotency, and cross-channel suppression.

## Core CRM definitions

For the demo, reporting timestamps normalize to `America/New_York`. Source timestamps and their original offsets are retained.

A current customer is an account with at least one site that has an active field-service contract or a completed job in the last 13 months, after reconciliation under decision 0004. A closed-won opportunity by itself does not prove that the account remains a current customer. Missing, ambiguous, or contradictory customer status blocks activation until reviewed.

An open opportunity is an associated Opportunity of the approved new-business type whose stage is not closed-won or closed-lost. Implementation, renewal, and support opportunity types do not silently count as new-business opportunities; their treatment must be mapped explicitly before a live deployment.

A logged sales activity for deal staleness includes a completed call, one-to-one sales email, prospect reply, completed meeting, or completed sales task associated directly with that deal. Company-only activity does not reset a deal's clock because it may belong to a different commercial motion. Notes and automated marketing events do not reset deal staleness.

A future task is an incomplete owner-assigned sales task with a due timestamp after the audit timestamp. Tasks without owners do not satisfy the requirement.

Suppression is deny-first. If Attio, Lemlist, or TitanX disagree, the most restrictive applicable signal wins until the conflict is resolved.

## Company identity

The proposed canonical company key is the normalized root domain. Records without a trustworthy domain remain unresolved and cannot be activated.

Known franchises, subsidiaries, holding companies, and intentionally separate locations require an explicit identity override. The application must never merge companies solely because their names are similar.

## Hard eligibility versus soft targeting

The application separates hard eligibility from targeting priority.

Hard eligibility contains only conditions that make outreach unsafe, irrelevant, or operationally impossible: unresolved identity, customer or open-opportunity status, consent and channel suppression, serviceability, missing ownership, missing usable contact data, and lack of human approval.

ICP characteristics are soft signals. They influence ordering and messaging but do not create a sharp inclusion boundary. A company just above or below an employee, revenue, or location-count cutoff must not receive meaningfully different treatment solely because it crossed that number.

Change propensity is more important than superficial firmographic precision. The system should prioritize people likely to challenge an existing process, including a relevant leader who recently joined the company, moved into a new role, inherited a new region, or arrived during organizational change.

Tenure is contextual rather than universally good or bad. A newly hired facilities or operations leader may have a mandate to change vendors, while a person with decades in the same role may be less likely to initiate change. These are prioritization hypotheses with visible evidence, not facts about an individual.

## Required company fields

An account cannot be activated without:

- Canonical company identifier
- Company name
- Root domain
- Lifecycle or customer status
- Serviceable geography
- A minimally relevant commercial context for the approved play
- CRM owner or explicit unassigned status
- Last CRM modification timestamp

Industry, employee count, revenue, location count, and other firmographics may improve prioritization but are not hard activation cutoffs. Missing soft fields lower data confidence and may trigger enrichment; they do not automatically disqualify an otherwise safe, relevant account.

## Required contact fields

A contact cannot be activated without:

- Canonical contact identifier
- First and last name
- Associated canonical company
- Job title
- Mapped persona
- CRM owner
- Consent and suppression status
- At least one channel-specific verified contact method

## Proposed time definitions

- Open deal is stale after 14 calendar days without a logged sales activity and without a future task.
- Prospect contact is stale after 90 calendar days without a logged activity or verified enrichment refresh.
- Enrichment is considered fresh for 90 calendar days.
- Interested reply has an internal service-level target of human attention within one business hour during the assigned owner's working day.
- Completed call requiring follow-up must have a dated next task before the call can be treated as closed work.

For the fictional demo, the interested-reply service-level agreement (SLA) is an internal response target, not a customer contract. Its clock runs Monday through Friday from 9:00 a.m. through 5:00 p.m. in `America/New_York`. Holiday calendars are deferred; the limitation must be visible in the demo.

These thresholds are demo business definitions, not universal best practices.

## Email-ready definition

A contact is email-ready only when all of the following are true:

- The associated company is serviceable and relevant to the approved play; its soft score is visible but is not a hard gate.
- The company is not a customer and has no open opportunity.
- The contact is not suppressed or unsubscribed.
- The email is verified and its provenance is recorded.
- The contact maps to an approved persona.
- A CRM owner exists.
- No unresolved critical health finding applies.
- A manager has approved the contact, campaign, and message version.

## Phone-ready definition

A contact is phone-ready only when all of the following are true:

- The associated company is serviceable and relevant to the approved play; its soft score is visible but is not a hard gate.
- The company is not a customer and has no open opportunity.
- The contact is not marked do-not-call or globally suppressed.
- A usable direct or mobile phone number exists with provenance.
- The contact maps to an approved persona.
- Territory and time zone are known.
- A CRM owner exists.
- No unresolved critical health finding applies.
- A manager has approved the contact and call play.

## Proposed channel policy

The first version assigns exactly one active outbound channel per contact at a time. A contact may qualify for both channels, but approval selects a primary channel. This avoids email and calls being launched independently without shared context.

A manager may move a non-engaged contact to the other channel after the first play ends. Positive engagement, an unsubscribe, do-not-call status, an open opportunity, or customer status suppresses future automated activation.

## Ownership policy

Every activated contact must have a named Attio owner, a workspace member. The owner is responsible for interested replies, scheduled follow-ups, and disposition quality. The application may recommend an owner but may not assign one without an approved ownership rule.

## Write policy

The Attio sync connector is read-only, uses an access token limited to read scopes, and connects only to the project workspace holding real Georgia operators and facilities from public sources, with no fictional CRM history under decision 0010.

Writes run automatically, without per-write approval, under decision 0012 as amended on 2026-10-22. They use a separate standing write token scoped to the objects and fields the Clay writeback writes, and are limited to People, versioned custom attributes, Tasks, and controlled List entries.

- Enrichment fills empty fields only.
- A value that conflicts with a human-entered value is never overwritten silently; it goes to the review queue.
- Uncertain identity matches, unverified personas (CRM-DATA-001), and possible duplicates also go to the review queue instead of being written.
- Every write records its source, retrieval date, and rule version.

An inbound Lead is matched to an existing Account before any follow-up. A matched Lead inherits the Account's customer, opportunity, and suppression state. An unmatched Lead cannot be activated.

The application will not automatically delete, merge, convert Leads, change opportunity stages, change lifecycle stages, reassign owners, or overwrite a human-entered value with a lower-confidence enriched value.

## Success criteria for the demo

- Every target is accompanied by a visible reason and evidence.
- No customer, open opportunity, unsubscribed contact, or unresolved duplicate can be activated.
- Repeated jobs cannot create duplicate enrollment.
- Every external action is traceable to an approval and rule version.
- A rep can identify the next required action without opening every connected tool.
- Another operator can understand and run the system from the repository and runbook.

