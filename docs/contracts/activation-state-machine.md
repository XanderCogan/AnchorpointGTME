# Activation State Machine

Status: approved as the future activation contract on 2026-10-17. Amended on 2026-10-19 under decision 0005 to use Salesforce Campaigns for the calling handoff; states and transitions are unchanged. Connector transitions remain deferred to their gated milestones.

Frozen version: `activation-states-v1`

The state machine applies to a contact within a specific play. CRM lifecycle stage and deal stage remain separate Salesforce concepts.

## States

- `discovered`: present in the candidate market but not audited
- `audit_blocked`: one or more critical CRM findings prevent progress
- `enrichment_eligible`: passes suppression checks but lacks scoring or channel data
- `enrichment_queued`: submitted to Clay with an idempotency key
- `enrichment_failed`: Clay processing exhausted bounded retries or returned unusable data
- `scored`: account score computed with a stored version and evidence
- `below_threshold`: account does not meet the play threshold
- `approval_pending`: score and channel readiness pass; no external activation is allowed
- `approved_email`: manager approved the contact and Lemlist campaign version
- `approved_phone`: manager approved the contact and TitanX call play
- `active_email`: Lemlist accepted the idempotent enrollment
- `active_phone`: contact entered the controlled Salesforce Campaign used for TitanX
- `engaged`: a positive reply, connected qualified call, or meeting signal was recorded
- `nurture`: the contact is valid but the next action is intentionally deferred
- `disqualified`: a reviewed commercial reason removes the contact from the play
- `suppressed`: consent, customer, open-opportunity, identity, or cross-channel safety rules prohibit activation
- `complete`: the play ended with a documented disposition and no pending action

## Normal flow

```text
discovered
  |-> audit_blocked
  |-> enrichment_eligible -> enrichment_queued -> scored
                                             |-> below_threshold
                                             |-> approval_pending
                                                   |-> approved_email -> active_email
                                                   |-> approved_phone -> active_phone

active_email | active_phone
  -> engaged | nurture | disqualified | complete
```

`suppressed` can be entered from any pre-activation or active state when a higher-priority suppression signal appears.

## Transition rules

- Only the audit engine can move `discovered` to `audit_blocked` or `enrichment_eligible`.
- Only a completed, validated enrichment result can leave `enrichment_queued` for scoring.
- Only the versioned scoring engine can create `scored` or `below_threshold`.
- Only a human manager can create `approved_email` or `approved_phone`.
- Approval must identify the user, timestamp, score version, message or call-play version, and proposed record set.
- Connector acceptance, not job submission, creates `active_email` or `active_phone`.
- Positive engagement suppresses future automated outbound on the other channel.
- Unsubscribe and do-not-call signals override score, approval, and active state.
- A new customer or open opportunity signal immediately removes the contact from pending activation and stops future steps where the external system permits it.
- Reprocessing the same transition with the same idempotency key must not create a second external action.

## Failure behavior

Transient connector failures retain the prior business state and create a retryable job. Exhausted retries create a visible integration failure; they do not pretend the next state was reached.

If an external action succeeds but the response is lost, reconciliation must look up external state before retrying creation.

## Reversal behavior

Approval can be withdrawn before external activation. After Lemlist sends a message or TitanX completes a call, the action is historical and cannot be rolled back. The system may stop future steps, correct CRM properties, and record remediation, but it must preserve the original event.

