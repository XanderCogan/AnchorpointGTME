# Decision 0011: Attio Replaces Salesforce as the CRM System of Record

Status: approved on 2026-10-21. Items listed under "Open within this decision" remain open.

Date: 2026-10-21  
Decision owner: User  
AI role: drafted this record and mapped what decision 0005 left behind

## Decision

Attio is Anchorpoint's CRM system of record for all work after Milestone 2. This supersedes decision 0005.

Milestone 2 stays as built and accepted. `inspection-v1` remains an immutable HubSpot-shaped audit release, and the deployed application keeps working against it. The core audit and scoring model stays CRM-neutral, so Attio-specific names live in a mapping layer, as decision 0005 required for Salesforce.

Decision 0010 is unchanged: the Attio workspace holds real Georgia operators and facilities only, with no fictional deals, activity, or history.

## Rationale

Attio's object model fits the market model directly: Companies with a parent record reference, a custom Site object so facilities never count as accounts, People linked to Companies, and Lists as controlled activation audiences. Its API is simple to run read-only and to scope separately for writeback, it has a native Lemlist app, and it removed the Salesforce JWT and sandbox setup cost under the one-day timeline. The choice was made on fit and setup cost, not on a formal vendor comparison.

## Object mapping, proposed

- Parent operators and regional operating entities become Company records, linked by a parent-company record-reference attribute, since Attio has no built-in account hierarchy.
- Physical facilities become a custom Site object referencing their operating Company, so sites never count as separate accounts in tiering totals.
- Buyers and influencers become People records linked to Companies.
- Opportunities become Deal records.
- Workspace members replace Salesforce Users as accountable owners.
- Tasks replace Salesforce Tasks. Calls, which need a disposition Attio tasks cannot hold, are a custom call-log object (added on 2026-10-22 when the connector was built).
- Lists replace Campaigns for controlled activation audiences, including the phone handoff.
- Email and call suppression become explicit checkbox attributes on People. Deny-first suppression is unchanged.

## Consequences

- Milestone 3 becomes a read-only Attio connection using an access token limited to read scopes. Its exit gate is unchanged in substance: repeated syncs are idempotent and no Attio records are changed.
- The Salesforce connector, mirror migration, mapping, recorded fixtures, and tests built under decision 0005 are superseded. They stay in the repository as reference until the Attio connector replaces them, and are not milestone evidence for Attio.
- The audit rules gain an Attio mapping, reusing the CRM-neutral model and the analysis pipeline in `docs/research/crm-icp-analysis-playbook.md`.
- The owning documents that named Salesforce were revised on 2026-10-21.
- Railway PostgreSQL stays. Supabase remains out of the plan.

## Open within this decision

- Whether Lemlist and TitanX integrate with Attio natively or need the application to bridge them, confirmed through one bounded lookup each. Lemlist: resolved on 2026-10-22. Lemlist publishes a native Attio app in the Attio app store (push a contact or a bulk selection into a campaign from the record, duplicate skip, email finding at enrollment, opens, clicks, replies and bounces written back as Attio activities, status and deal automations). Sources: https://attio.com/help/reference/apps/data-and-enrichment-apps/lemlist-app, https://www.lemlist.com/integrations/attio, https://help.lemlist.com/en/articles/15554084-how-to-connect-attio-and-lemlist, retrieved 2026-10-22. Installed on 2026-10-22 under decision 0015, which makes membership of an approved Attio List the enrollment trigger; the application's deny-first planner, suppression, ledger, and kill switch still govern what reaches a campaign. TitanX is moot under decision 0014.
- Whether the Lead concept for unmatched inbound hand-raisers is a separate Attio object or a status on People.
- Whether Deal types use one pipeline with a type attribute or separate lists.
