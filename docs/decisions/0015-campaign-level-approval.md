# Decision 0015: Campaign-Level Approval and Native Lemlist Enrollment from Attio

Status: approved on 2026-10-22. The native Lemlist app is installed in the workspace and the planner reads approval from List membership, verified on fixtures; the remaining gap is in `docs/portfolio/gap-statement.md`.

Date: 2026-10-22  
Decision owner: User  
AI role: described the industry-standard enrollment pattern and the gap it leaves against the operating contract

## Question

Should every enrollment keep requiring a recorded per-contact human approval, or should approval work the way an ordinary sales team runs a sequencer?

## Decision

Approval moves from the contact to the campaign. A sales manager or RevOps owner approves a campaign once: its copy and message version, its audience definition (tier bands, personas, serviceability), and its senders. After that, enrollment is automatic from audience membership. The audience is an Attio List; a Person enters it by meeting the approved definition or by a rep adding them, and the native Lemlist app in Attio pushes List members into the approved campaign. The per-contact approval ledger becomes an audit log of who enrolled whom and under which rule version, not a gate.

What stays hard: consent and channel suppression, deny-first across Attio and Lemlist, including unsubscribes and bounces written back as suppressions; duplicate prevention; serviceability and identity resolution; a named Attio owner; and the kill switch, which is now the Lemlist campaign pause plus the local enrollment block. No outreach ever happens in this project: no sending domain, mailbox, or attached sender exists (decision 0012 as amended).

The native Lemlist app for Attio is installed in the workspace for this purpose. The lookup that found it is recorded in decision 0011. Installation was done by the user on 2026-10-22, since it requires creating a Lemlist API key and pasting it into Attio.

## User rationale

The user wants every decision to follow what a company of this size would actually do unless money or time rules it out, and wants a functioning click-and-go workflow owned by RevOps rather than one that needs a GTM engineer present. Per-contact approval is not how sales teams run sequencers; campaign-level approval with automatic enrollment from a CRM list is.

## Consequences

- Operating contract lines requiring that a manager approve each contact are amended to campaign-level approval; the rest of the hard-eligibility list stands.
- The planner's `not_approved` check reads Attio List membership in the approved campaign's audience List (`--approved-list` or `ATTIO_APPROVED_LIST`), through the read-only transport, which now allows the list-entries query. Only People entries count. The approvals file remains for offline runs.
- Decision 0001 is unchanged except that the "human approval" hard gate now means campaign approval plus audience membership.
- The Milestone 5 approval interface is no longer needed as a per-contact screen. What remains is the Attio List and the campaign approval record.
