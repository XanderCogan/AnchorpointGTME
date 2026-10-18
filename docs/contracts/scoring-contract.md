# Account Scoring Contract

Status: approved and amended after user review on 2026-10-17. Implementation remains deferred to its gated milestone.

Frozen version: `account-score-v1.1`

The score prioritizes accounts and people; it does not define a hard ICP border. It never overrides suppression or activation-readiness rules. A high-scoring customer, open opportunity, duplicate, or uncontactable record remains blocked.

## Targeting principle

Prioritize propensity to drive change, not just static ICP fit.

Firmographics describe whether a company could plausibly benefit. Change signals help estimate whether a particular person may act now. The system therefore treats company size, revenue, employee count, and location count as gradual evidence rather than pass-or-fail thresholds.

A company with 201 employees must not be treated as meaningfully different from one with 200. Likewise, a relevant new operations leader at a slightly imperfect account may deserve attention before a perfect-fit account whose likely buyer has shown no reason to change.

## Score structure

The proposed score is a transparent 100-point prioritization aid:

- Change propensity: up to 40 points
- Operational need and account context: up to 35 points
- Person relevance and influence: up to 15 points
- Data confidence: up to 10 points

Every awarded point must retain its input value, source, freshness, and rule version. Unknown values reduce confidence and contribute no unsupported points; they are not treated as confirmed negative values.

## Change propensity

Change signals are observable hypotheses about timing. They decay with age and must never be invented from generic company descriptions.

- Relevant leader joined the company or moved into the role recently: up to 16
- Acquisition, expansion, new region, new facilities, or operating-model change: up to 10
- Relevant facilities, compliance, safety, procurement, or property-operations hiring: up to 8
- Verified engagement or another approved timely trigger: up to 6

Role tenure uses a gradual decay rather than a cliff. The exact function will be tested during the scoring milestone. Recent entry into the role receives more weight, and the contribution tapers as tenure increases. Long tenure never creates a suppression or automatic exclusion.

## Operational need and account context

The initial play values evidence of a recurring multi-site fire and life-safety coordination problem. Relevant inputs include location footprint, geographic dispersion, regulated operating environment, fragmented brands or regions, and the likelihood of multiple inspection or service schedules.

Numeric firmographics use smooth normalization or broad overlapping ranges. They must not create one-unit cliffs. For example, location count can increase priority gradually while adjacent commercial segments remain eligible for human review.

This category contributes up to 35 points. The exact normalized inputs will be frozen with scoring fixtures before implementation.

## Person relevance and influence

Person relevance is based on likely ability to understand, influence, or sponsor the change—not a rigid title list.

- Direct functional ownership of facilities, safety, compliance, procurement, or property operations: up to 8
- Evidence of regional, budget, vendor, or implementation influence: up to 5
- Adjacent role with a credible path to the owner: up to 2

Seniority can support an inference but does not substitute for functional relevance. A new procurement or regional operations leader may outrank a long-tenured executive with no apparent connection to the problem.

## Data confidence

- Canonical domain and CRM identity resolved: 2
- Serviceable geography verified: 2
- Location-count band has recorded provenance: 2
- Persona and current employment verified: 2
- At least one channel-specific contact method verified: 2

## Priority bands

- Priority A: strongest current evidence
- Priority B: credible target with moderate timing evidence
- Priority C: relevant but research or timing is weaker
- Watch: safe and potentially relevant, but not recommended for the current work queue

The scoring milestone will set display bands only after inspecting fixture distributions. Bands affect ordering, not eligibility. Any hard-eligible record can be selected by a manager, and records near a band boundary must retain their raw score and explanation so the label does not imply a meaningful discontinuity.

## Score explanation

The play table must display a sentence assembled from verified structured inputs, such as:

> High priority because Anchorpoint serves this geography, the company operates a distributed senior-living footprint, and a newly hired Facilities Director arrived while the company was adding regional compliance roles.

The explanation cannot introduce facts that did not contribute to the score.

## Versioning

Every scored account stores the scoring version and input snapshot. Changing a weight or threshold creates a new version and triggers an explicit rescore; historical approvals retain the version used at decision time.

