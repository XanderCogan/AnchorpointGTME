# Decision 0012: Build Milestones 5 to 7 Early on Practice Fixtures

Status: approved on 2026-10-22. Amended the same day: no email is ever sent and no call is ever placed.

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

Amended on 2026-10-22 by the user. This is a practice project, but Anchorpoint is treated as a real company, so the integration is built as it would be for one.

- The Lemlist connector calls the real Lemlist API. It creates campaigns, adds leads, reads activity, and handles unsubscribes through the documented endpoints, not a mock. If a real company switched it on, it should work.
- The send path is built and tested but switched off. The kill switch defaults to off, and the code never launches a campaign in this project.
- No sending infrastructure is set up. No sending domain is bought, no mailbox is connected, and no warm-up period is run. With no sender attached, Lemlist cannot send even if a campaign were launched by mistake. Switching on for real would need a company's own warmed mailboxes, which is out of scope here.
- Anchorpoint has no real SDRs. The manager and two representatives in the brief are fictional roles inside the application. They approve contacts in the app, and are never Lemlist senders.
- Live writes go to one test campaign in Lemlist, kept as a draft and holding only `example.com` practice leads. The user gave standing approval for those writes on 2026-10-22; any other live write still needs the user's OK.

## Boundaries that still hold

- Practice fixtures use fictional people with reserved addresses, such as `example.com` domains and fictional-use phone numbers. They are labelled synthetic and are never market evidence, under decision 0010.
- The human-approval gate, deny-first suppression, kill switch, and idempotent enrollment are built as specified, as they would be for a real client.
- Writes to Attio during development go only to test lists the user has named, after the user approves each one. Lemlist writes follow the standing approval above.
- The human-approval gate in the application is one simple approve step by a fictional representative or manager, not a chain of reviews.

## Consequences

- The build plan's rule that each milestone is reviewed before the next gains a second exception, alongside decision 0008.
- Milestones 6 and 7 still follow Milestone 5 in design: enrollment and handoff consume approval decisions. Building them in parallel means building against fixture approval decisions until the real approval table exists.
- Whether Lemlist and TitanX integrate with Attio natively, which is open under decision 0011, still needs one bounded lookup each. It shapes the Milestone 7 bridge but does not block building against fixtures.
