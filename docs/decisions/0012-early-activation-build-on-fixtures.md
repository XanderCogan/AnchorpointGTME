# Decision 0012: Build Milestones 5 to 7 Early on Practice Fixtures

Status: approved on 2026-10-22.

Date: 2026-10-22  
Decision owner: User  
AI role: drafted the record from the user's instruction, the build plan, and `STATE.md`

## Question

The build plan says each milestone is reviewed before the next begins. Under the one-day timeline, must the scoring and approval table (Milestone 5), the Lemlist activation (Milestone 6), and the TitanX handoff (Milestone 7) wait for Milestones 3 and 4 to be accepted?

## Decision

No. The code for Milestones 5, 6, and 7 is built now, in parallel with Milestones 3 and 4, against labelled synthetic practice fixtures. Their exit gates may be met on those fixtures without waiting for earlier milestones to be accepted.

The real data path is unchanged: real Georgia accounts flow from Attio through the Clay enrichment waterfall, then into scoring, approval, Lemlist, and TitanX. When that data exists, it replaces the practice fixtures as input.

## Boundaries that still hold

- Nothing goes live from practice data. No Lemlist lead is enrolled in a launched campaign, no email is sent, and no contact is placed on the Attio List that TitanX reads, unless the contact came through the real data path and a human approved it.
- Practice fixtures use fictional people with reserved addresses, such as `example.com` domains and fictional-use phone numbers, so they cannot reach a real person even by mistake. They are labelled synthetic and are never market evidence, under decision 0010.
- The human-approval gate, deny-first suppression, kill switch, and idempotent enrollment are built as specified. Building early does not weaken them.
- Writes to Lemlist or Attio during development go only to draft campaigns or test lists the user has named, and only after the user approves each one.

## Consequences

- The build plan's rule that each milestone is reviewed before the next gains a second exception, alongside decision 0008.
- Milestones 6 and 7 still follow Milestone 5 in design: enrollment and handoff consume approval decisions. Building them in parallel means building against fixture approval decisions until the real approval table exists.
- Whether Lemlist and TitanX integrate with Attio natively, which is open under decision 0011, still needs one bounded lookup each. It shapes the Milestone 7 bridge but does not block building against fixtures.
