# Decision 0011: Attio Replaces Salesforce as the CRM System of Record

Status: approved by the user in conversation on 2026-10-21 ("final answer"). Items listed under "Open within this decision" remain open.

Date: 2026-10-21  
Decision owner: User  
AI role: drafted this record and mapped what decision 0005 left behind

## Decision

Attio is Anchorpoint's CRM system of record for all work after Milestone 2. This supersedes decision 0005.

Milestone 2 stays as built and accepted. `inspection-v1` remains an immutable HubSpot-shaped audit release, and the deployed application keeps working against it. The core audit and scoring model stays CRM-neutral, so Attio-specific names live in a mapping layer, as decision 0005 required for Salesforce.

Decision 0010 is unchanged: the Attio workspace holds real Georgia operators and facilities only, with no fictional deals, activity, or history.

## Object mapping, proposed

- Parent operators and regional operating entities become Company records, linked by a parent-company record-reference attribute, since Attio has no built-in account hierarchy.
- Physical facilities become a custom Site object referencing their operating Company, so sites never count as separate accounts in tiering totals.
- Buyers and influencers become People records linked to Companies.
- Opportunities become Deal records.
- Workspace members replace Salesforce Users as accountable owners.
- Tasks and Notes replace Tasks and Events.
- Lists replace Campaigns for controlled activation audiences, including the phone handoff.
- Email and call suppression become explicit checkbox attributes on People. Deny-first suppression is unchanged.

## Consequences

- Milestone 3 becomes a read-only Attio connection using an access token limited to read scopes. Its exit gate is unchanged in substance: repeated syncs are idempotent and no Attio records are changed.
- The Salesforce connector, mirror migration, mapping, recorded fixtures, and tests built under decision 0005 are superseded. They stay in the repository as reference until the Attio connector replaces them, and are not milestone evidence for Attio.
- The audit rules gain an Attio mapping, reusing the CRM-neutral model and the analysis pipeline in `docs/research/crm-icp-analysis-playbook.md`.
- The owning documents that named Salesforce were revised on 2026-10-21. The project workspace is `10-x-media` at https://app.attio.com/10-x-media.
- Railway PostgreSQL stays. Supabase remains out of the plan.

## Open within this decision

- Whether Lemlist and TitanX integrate with Attio natively or need the application to bridge them, confirmed through one bounded lookup each. TitanX was previously reached through its Salesforce integration.
- Whether the Lead concept for unmatched inbound hand-raisers is a separate Attio object or a status on People.
- Whether Deal types use one pipeline with a type attribute or separate lists.
