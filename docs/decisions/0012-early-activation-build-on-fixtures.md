# Decision 0012: Build Milestones 5 to 7 Early on Practice Fixtures

Status: approved on 2026-10-22. Amended the same day: no email is ever sent and no call is ever placed, and Anchorpoint is run as a real company would run it (see the last amendment).

Date: 2026-10-22  
Decision owner: User  
AI role: drafted the record from the user's instruction, the build plan, and `STATE.md`

## Question

The build plan says each milestone is reviewed before the next begins. Under the one-day timeline, must the scoring and approval table (Milestone 5), the Lemlist activation (Milestone 6), and the TitanX handoff (Milestone 7) wait for Milestones 3 and 4 to be accepted?

## Decision

No. The code for Milestones 5, 6, and 7 is built now, in parallel with Milestones 3 and 4, against labelled synthetic practice fixtures. Their exit gates may be met on those fixtures without waiting for earlier milestones to be accepted.

The real data path is unchanged: real Georgia accounts flow from Attio through the Clay enrichment waterfall, then into scoring, approval, Lemlist, and TitanX. When that data exists, it replaces the practice fixtures as input.

## No outreach, ever

Amended on 2026-10-22 by the user. This project never contacts anyone, from practice data or real data.

- No email ever leaves Lemlist. No Lemlist campaign is ever launched; enrollment stops at dry runs and draft or paused campaigns.
- TitanX never places a call. The Attio List that TitanX would read is built and proven, but no dialing is ever started from it.
- The system is built and demonstrated up to the handoff point and stops there. Milestones 6 and 7 are accepted on dry runs, fixtures, and handoff records, never on sent email or completed calls.

## Real integration, switched off

Amended on 2026-10-22 by the user. Anchorpoint is treated as a real company, so the integration is built as it would be for one.

- The Lemlist connector calls the real Lemlist API. It creates campaigns, adds leads, reads activity, and handles unsubscribes through the documented endpoints, not a mock. If a real company switched it on, it should work.
- The send path is built and tested but switched off. The kill switch defaults to off, and the code never launches a campaign in this project.
- No sending infrastructure is set up. No sending domain is bought, no mailbox is connected, and no warm-up period is run. With no sender attached, Lemlist cannot send even if a campaign were launched by mistake. Switching on for real would need a company's own warmed mailboxes, which is out of scope here.
- Anchorpoint has no real SDRs. The manager and two representatives in the brief are fictional roles inside the application. They approve contacts in the app, and are never Lemlist senders.
- Lemlist campaigns are kept as drafts or paused and never launched. Approved real contacts from Attio may be enrolled under the amendment below.
- The connector no longer limits leads to `example.com` or writes to one configured campaign. In their place, the transport refuses any lead add or launch into a campaign that has a sender attached. Details are in `docs/milestones/milestone-6-lemlist-notes.md`.

## Boundaries that still hold

- Practice fixtures use fictional people with reserved addresses, such as `example.com` domains and fictional-use phone numbers. They are labelled synthetic test inputs and are never market evidence, under decision 0010.
- The human-approval gate, deny-first suppression, kill switch, idempotent enrollment, and an exceptions review queue are built as specified, as they would be for a real client.
- Attio writes follow the operating contract's write policy, as amended below.
- The human-approval gate in the application is one simple approve step by a fictional representative or manager, not a chain of reviews.

## Amendment, 2026-10-22: run as a real company

Decided by the user. Every practice-only constraint is dropped except two: budget limits, and no outreach ever as set out above (no sending domain or mailbox, no launched campaign, TitanX never dials).

- Attio writes no longer need per-write user approval or user-named test lists. Writes are automated under the write policy in `../contracts/operating-contract.md`: enrichment fills empty fields, and conflicts with human-entered values, uncertain identity matches, unverified personas (CRM-DATA-001), and possible duplicates go to a review queue instead of being written.
- The one-time setup token pattern is replaced by a standing write token scoped to the objects and fields the Clay writeback writes. The sync connector stays read-only; writeback is a separate, scoped path. The user must still create that token; none exists yet.
- Clay is no longer run by hand. Attio sends accounts to Clay, Clay runs the waterfall, and Clay writes contacts back to Attio. This needs a paid Clay plan, because the free plan excludes CRM integrations, the HTTP API, and scheduled runs; any purchase is confirmed with the user at the shown price. The exact integration method is pending a separate lookup.
- Contacts, including work email, are stored in Attio as People. Real people's details still never go in the public repository.
- Approved real contacts from Attio feed Lemlist enrollment. Practice fixtures remain as test inputs only.

## Consequences

- The build plan's rule that each milestone is reviewed before the next gains a second exception, alongside decision 0008.
- Milestones 6 and 7 still follow Milestone 5 in design: enrollment and handoff consume approval decisions. Building them in parallel means building against fixture approval decisions until the real approval table exists.
- Whether Lemlist and TitanX integrate with Attio natively, which is open under decision 0011, still needs one bounded lookup each. It shapes the Milestone 7 bridge but does not block building against fixtures.
