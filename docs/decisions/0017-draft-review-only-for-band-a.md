# Decision 0017: Per-Email Review Only for Band A

Status: approved on 2026-10-22. Built the same day in the draft gate and the practice source; the first draft carried under it is recorded in `STATE.md`.

Date: 2026-10-22  
Decision owner: User  
AI role: described how sequencer teams gate AI-personalized copy and the change to the built gate

## Question

Decision 0015 made approval campaign-level, but the signal-based drafting step still held every AI-written email until a person marked its file reviewed. Should every email be read by a human before it can be queued?

## Decision

No. A human approves the campaign once, as decision 0015 says: its template, audience definition, and senders. Within an approved campaign, a draft written by the model from the public fact sheet travels into Lemlist automatically, because the drafting contract and its validator already constrain what it can say: one public record as the hook, no claims about the person, no pricing, urgency, or competitors, under 120 words.

The per-email review mark stays only for band A operators. Those are the few accounts the team is being most careful with, and a person reads each draft before it is queued. For every other band the review fields may stay empty and the draft carries without them.

The offline approvals file now applies to the practice source as well as the Attio source, so a labelled practice contact can be approved for a dry run or a live enrollment into the unlaunched campaign without editing the committed fixture.

## User rationale

If a person has to approve every cold email, the team might as well write them by hand. A GTM team runs a reviewed template and trusts the generator inside its guardrails, and reads individual copy only where the account justifies it.

## Consequences

- `attachDrafts` skips a contact as `draft_not_reviewed` only when the draft's operator band is A and the review fields are empty. Other drafts carry their copy as Lemlist variables; the review variables are included only when filled.
- `lemlist:enroll --source practice --approvals <file>` overlays the file's approvals on the practice contacts. The fixture itself is unchanged and still leaves `practice-008` unapproved.
- Nothing else in the stop line moves: no sending domain, mailbox, launched campaign, or attached sender exists, and enrollment stays deny-first with the ledger and kill switch.
