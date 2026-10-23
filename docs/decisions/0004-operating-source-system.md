# Decision 0004: Fictional Operating Source System Reconciled with the CRM

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the proposal from the TAM construction plan and decision 0003

## Question

Which field-service, billing, or ERP source holds Anchorpoint's operational truth, and how is it reconciled with the CRM before commercial outcomes count as evidence? The TAM plan requires this reconciliation before the historical dataset can support ICP hypotheses.

## Proposed decision

Anchorpoint's operational system of record is a field-service management (FSM) platform shaped like ServiceTrade, a fire-protection-focused FSM product. Only the export shape is modeled. Every record in it is fictional, and no ServiceTrade connector is planned or implied.

The CRM is Attio under decision 0011, which superseded Salesforce; Salesforce names below are kept as written and read as Attio Companies and Sites. The FSM, not the CRM, is the truth for whether a site is a customer, what was serviced, what was invoiced, and when service stopped.

### Why an FSM rather than an ERP

Regional fire and life-safety companies run their operations from the FSM: recurring inspection schedules, technician appointments, deficiencies, quotes, and invoices all live there. A general ledger exists, but it does not know about sites, systems, or deficiencies, so it cannot answer serviceability or expansion questions. The general ledger is out of scope; invoice totals in the FSM export stand in for recognized revenue.

### Modeled entities

- Customer, the billing entity, which may map to a Salesforce parent or regional operator Account
- Location, the physical serviced site, which maps to a Salesforce Site and carries the address used for drive time under decision 0003
- Asset, an installed system at a location, such as a sprinkler riser, alarm panel, extinguisher set, or hood system
- Service recurrence, the contracted inspection schedule per asset and service line
- Job and appointment, completed or missed work with dates and branch
- Deficiency, an inspection finding with severity and status
- Quote, a priced remedy for one or more deficiencies, with accepted, declined, or expired status
- Invoice, with recurring or project classification, amount, and date
- Contract, the recurring agreement with start, renewal, and cancellation dates

### Acquisition-era system history

The source systems differ by branch, consistent with the roll-up in decision 0003:

- Atlanta and Macon run on the FSM. Macon migrated two years after acquisition, so its earlier history exists only as imported opening customers and recurrences without job detail.
- Greenville was migrated at acquisition close. Its pre-acquisition history is a one-time summarized import.
- Savannah has not migrated. Its operations live in a legacy accounting export, shaped like QuickBooks Desktop invoices, plus a route spreadsheet for extinguisher and hood work. It has no asset or deficiency records.

These gaps are deliberate. They make reconciliation produce explicit unknowns rather than clean answers, and they keep Savannah's evidence visibly weaker.

### Reconciliation rules

Each FSM location and customer is matched to Salesforce Accounts and Sites and assigned exactly one state:

- matched, when identity agrees;
- matched with conflict, when identity agrees but a field such as owner, status, or address disagrees;
- CRM only, such as a prospect or a stale customer record with no service history;
- FSM only, such as a serviced site never entered in the CRM, which is common for acquired-branch customers; or
- ambiguous, when more than one candidate match exists and a human must resolve it.

Matching uses a shared external identifier when present, then normalized address plus customer name. Ambiguous matches never merge automatically.

Commercial truth follows the FSM:

- A site is an active customer when it has an active contract or a completed job in the last 13 months.
- Churn is a cancelled contract or no completed recurring job for 13 months after the last one.
- Expansion is a new service line or location added under an existing customer.
- A closed-won Opportunity with no matching FSM contract or invoice is a reconciliation finding, not a customer.

The 13-month window allows one late annual inspection before a site counts as lapsed.

## Rationale

The CRM in an acquired-company roll-up is usually the weakest record of who is actually a customer. Treating the FSM as truth, while keeping every mismatch visible, is how a RevOps team would trust the data enough to draw ICP hypotheses from it. Modeling a real fire-protection FSM's export shape makes the fixture credible to an operator without claiming a real integration.

## Consequences

- A new immutable fixture release will carry the FSM export alongside Salesforce-shaped CRM records. `inspection-v1` is unchanged.
- Reconciliation states become inputs to suppression: FSM-only and active customers cannot enter net-new activation, and ambiguous records cannot enter activation at all.
- Historical ICP analysis uses FSM outcomes, so Savannah contributes weaker evidence by design.
- The reconciliation runs against the CRM-neutral core model, so the matching rules survive a change of CRM provider.

## Open within this decision

- Confirming the FSM export field names against ServiceTrade's public API documentation through one bounded lookup
- Whether deficiency-to-quote conversion is modeled per deficiency or per quote
- The exact migration dates, which belong to the ordinary-company profile decision

## Required future tests

- A closed-won Opportunity with no FSM contract or invoice produces a reconciliation finding and is not counted as a customer.
- An FSM-only location is suppressed from net-new activation.
- An ambiguous match is not merged and blocks activation.
- A site whose last recurring job is 12 months old is active, and one at 14 months with no active contract is churned.
- Savannah records carry no asset or deficiency evidence and are not scored as if they did.
