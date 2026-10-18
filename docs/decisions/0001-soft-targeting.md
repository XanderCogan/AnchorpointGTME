# Decision 0001: Soft Targeting and Change Propensity

Status: approved. Implementation is deferred to the scoring milestone.

Date: 2026-10-17  
Decision owner: User  
AI role: translated the decision into the operating and scoring contracts

## Question

Should the system enforce a rigid ICP boundary based on firmographic cutoffs, or use those characteristics as soft prioritization signals?

## Decision

ICP characteristics are soft. Hard gates are reserved for safety, consent, identity, serviceability, ownership, and human approval.

The ranking model should prioritize observable propensity to drive change. A relevant person who recently joined a company, moved into a role, inherited responsibility, or arrived during organizational change may deserve attention before a superficially perfect-fit account with no reason to act.

## User rationale

A company with 201 employees is not meaningfully different from one with 200. Hard thresholds create false precision and discard good targets near arbitrary boundaries.

The more useful question is whether a person is likely to drive change. A procurement or operations professional who recently moved into a new company may be more willing to challenge the status quo than someone who has held the same position for decades.

## Rejected alternative

The rejected model used fixed ICP tiers and treated score thresholds as activation eligibility. That approach over-weighted firmographics, created discontinuities at arbitrary cutoffs, and under-weighted timing and individual agency.

## Consequences

- Account and person scores rank work; they do not grant permission to activate.
- Firmographic contributions must be gradual rather than one-unit cliffs.
- Role-change recency uses a decay curve instead of fixed age buckets.
- Functional relevance and evidence confidence modify role-change signals.
- Long tenure lowers a change-propensity contribution gradually but never causes automatic exclusion.
- Unknown values lower confidence rather than becoming negative evidence.
- The interface must show raw reasons and evidence, not only a score or band.
- A manager may approve any hard-eligible record regardless of its display band.

## Required future tests

- Accounts immediately above and below a numeric cutoff receive nearly identical contextual scores.
- A relevant recent hire at an adjacent-fit account can outrank a static perfect-fit account.
- An unrelated new executive receives no role-change contribution for this play.
- Missing role-start data reduces confidence without asserting low propensity.
- Display-band changes do not change hard eligibility.

