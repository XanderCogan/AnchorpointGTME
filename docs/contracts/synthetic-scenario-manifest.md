# Synthetic Scenario Manifest

Status: approved on 2026-10-17. Milestone 1 implements the CRM-audit subset first; scoring, connector, and feedback scenarios remain assigned to their later milestones.

Frozen version: `scenario-manifest-v1`

Milestone 1 will create deterministic fixtures and independently authored expected outcomes for the scenarios below. These are definitions only; no fixture records exist yet.

## Healthy baseline

Create a small group of companies and contacts with unique domains, complete associations, valid owners, supported geography, approved personas, current verified contact data, no suppressions, and internally consistent deal and activity history.

Expected outcome: no critical findings. Eligible records progress to scoring, but none activate without approval.

## Duplicate and identity scenarios

- Two company records share the same normalized root domain.
- Similar company names have different valid domains and must not be merged.
- A parent and subsidiary share a brand but have an approved identity override.
- A company has no domain and is otherwise eligible for enrichment.
- Two contacts share one normalized email.
- A contact has no associated company.
- An open deal has no associated company.

## Ownership and process scenarios

- Open deal has no owner.
- Activation candidate has no owner.
- Open deal has no activity for 15 days and no future task.
- Open deal has old activity but a valid future task and must not be marked stale.
- Open deal has no next-step value or future task.
- Completed call lacks a disposition.
- Positive reply exists but no owner follow-up occurs within the proposed service-level response target.

## Suppression scenarios

- Current customer appears in a candidate audience.
- Company with an open opportunity appears in a candidate audience.
- Contact has a Lemlist unsubscribe signal.
- Contact has a HubSpot do-not-call signal.
- Contact qualifies for both channels but email is suppressed; phone remains independently evaluated.
- Customer status arrives after approval but before connector activation.
- Unsubscribe arrives after Lemlist activation and must stop future steps without erasing history.

## Completeness and enrichment scenarios

- Company lacks serviceable geography.
- Company lacks location count.
- Contact title maps cleanly to an approved persona.
- Contact title is adjacent and requires review.
- Contact title has no approved persona.
- Clay returns a verified value that fills a missing field.
- Clay returns a lower-confidence value conflicting with a human-entered CRM value.
- Clay returns no result.
- Clay callback is delivered twice.
- Enrichment data is older than 90 days.

## Scoring boundaries

- Companies on opposite sides of an arbitrary employee or location cutoff receive nearly identical contextual contributions.
- A relevant recent hire at an adjacent-fit account can outrank a static perfect-fit account with no change signal.
- Long tenure lowers a change-propensity contribution gradually but never creates automatic exclusion.
- Unknown tenure reduces confidence without being treated as evidence that the person will not act.
- A person with direct functional influence can outrank a more senior but irrelevant title.
- Priority-band boundaries affect display and ordering but not eligibility.
- High score is blocked by an open opportunity.
- Unknown fit values receive no unsupported points and lower confidence rather than negative assumptions.
- Score recalculation under a new version preserves the historical approved score.

## Channel and idempotency scenarios

- Approved email-ready contact is enrolled once in Lemlist.
- Enrollment job retries after a timeout but does not create a duplicate lead.
- Approved phone-ready contact enters the TitanX HubSpot segment once.
- Contact qualifies for both channels but receives only the approved primary channel.
- Conflicting active-channel evidence creates a critical finding.
- Approval is withdrawn before activation.
- External activation succeeds but the response is lost; reconciliation discovers the existing action.

## Feedback scenarios

- Lemlist interested reply maps to one contact and creates rep work.
- Lemlist out-of-office reply does not count as positive engagement.
- Lemlist bounce removes email readiness and requests alternate research.
- TitanX connected call with a meeting disposition creates engagement.
- TitanX no-answer disposition preserves eligibility according to the approved call play.
- External event cannot be matched to one CRM identity and is quarantined.
- Duplicate external event is stored once and safely ignored on reprocessing.

## Time scenarios

- Activity at the stale threshold remains fresh.
- Activity one second beyond the stale threshold becomes stale.
- Service-level response target crosses a weekend or owner non-working period.
- Timestamps arrive in different offsets and normalize to one reporting time zone.

## Required independent controls

Before implementing the rules, Milestone 1 must record expected finding counts, affected record IDs, scores, tiers, readiness states, suppressions, and allowed transitions outside the application logic. Tests will compare implementation output with those frozen expectations.

