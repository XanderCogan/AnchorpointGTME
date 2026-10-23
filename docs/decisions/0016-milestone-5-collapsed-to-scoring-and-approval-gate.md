# Decision 0016: Milestone 5 Collapsed to Explainable Scoring and the Approval Gate

Status: approved on 2026-10-22. The build plan, gap statement, and `STATE.md` were updated in the same commit.

Date: 2026-10-22  
Decision owner: User  
AI role: identified that decision 0015 had made most of the original Milestone 5 scope redundant and proposed the collapsed definition

## Question

Milestone 5 was defined in the build plan as a play table and approval surface: explainable scoring, account tiers, contact recommendations, message inputs, per-contact approval decisions, and before-action previews, with a manager-facing screen. After decision 0015 moved approval to the campaign level and made enrollment automatic from an Attio List, should that screen still be built, or should the milestone be redefined around what the system now actually needs?

## Decision

Milestone 5 is redefined as "Explainable scoring and approval gate" and is complete as redefined.

What it now owns:

- Explainable account scoring: `scripts/georgia-sample/tier.ts` writes every component's points, input, and source into `data/georgia-sample/tiers.json`, with one explanation sentence per operator and the approved band thresholds.
- The approval gate: a contact can be enrolled only if they are a member of the approved campaign's audience List in Attio, read by the enrollment planner, with the approvals file kept for offline runs. The enrollment ledger records who was enrolled under which rule version.
- Before-action preview: the Lemlist dry run, which lists what would be enrolled and why each skipped candidate was skipped.
- Message inputs: the public fact sheet that `lemlist:draft` builds from the operator's cited records.

What is removed from the milestone:

- The per-contact approval screen and play table. Approval is a List membership in Attio, which is the screen. The explanation sentence in `tiers.json` answers why an account is in its band.
- A dedicated approvals table with approver, timestamp, and message version. That is a work-queue concern and moves to Milestone 8, which is the first thing that would read it.
- Person-level scoring beyond the Clay role slots. Channel verification has not run, and those points stay unearned in the tiering output rather than being promised by a milestone.

Exit gate, as redefined: every tiered operator has a written explanation of its band, and no contact can be planned for enrollment without campaign approval expressed as audience List membership. The gate is verified on fixtures, the same acceptance standard decisions 0008 and 0012 set for Milestones 6 and 7; creating the audience List in the workspace remains Milestone 6's open item.

## User rationale

The user did not want to carry an unmet milestone whose remaining scope the Attio List gate had already replaced, and preferred the build plan to describe the system as it is rather than a screen nobody now needs.

## Consequences

- `docs/product/build-plan.md` Milestone 5 carries the new definition and a complete status. Milestone 8 gains the approvals table.
- `docs/portfolio/gap-statement.md` section 3 is reduced to what moved to Milestone 8.
- `STATE.md` and `README.md` stop listing Milestone 5 as unbuilt.
- Decision 0015's note that the Milestone 5 approval interface is no longer needed as a per-contact screen is now the governing definition rather than an aside.
