# Decision 0008: Georgia Market Sample in Parallel with Milestone 3

Status: approved on 2026-10-19. Amended on 2026-10-20: the parallel historical-fixture track was cancelled in favour of the real-data market sample, and decision 0010 records what replaced it. The Georgia sample continued alone.

Date: 2026-10-19
Decision owner: User
AI role: drafted the proposal from the build plan, `STATE.md`, and decisions 0005, 0006, and 0007

## Question

The build plan says each milestone is reviewed before the next begins. The first Georgia market sample under decision 0007 belongs to Milestone 4, while Milestone 3, the read-only CRM connection, had not started. Must the sample wait for Milestone 3?

## Decision

No. The Georgia sample runs in parallel with Milestone 3, keeping decision 0007's budget, stopping rule, source and retrieval-date requirement, and personal data boundary. Milestone 4 is still accepted as one milestone; applying the sample's results to serviceability evidence, enrichment automation, and the exit gate waits for Milestone 3 acceptance.

A second parallel track, a generated 30-month commercial history loaded into the CRM so that Milestone 3 had data to sync, was approved at the same time and cancelled the next day. Synthetic history can only rediscover the ICP written into it, and the real-data market model is the centrepiece of the work sample. Decision 0010 governs what replaced it.

## Rationale

The Georgia sample depends on public records, not on a CRM connection. Running it alongside Milestone 3 removes idle time without weakening any review gate, read-only boundary, or approval requirement.

## Consequences

- The build plan's review-before-next rule gains one stated exception: the early Milestone 4 data work described here. Decision 0012 adds a second.
- When two tracks touch shared code, that code lands in one track at a time.

## Required future tests

- The Milestone 3 connector has no create, update, or delete path, and repeated syncs leave every CRM record unchanged.
