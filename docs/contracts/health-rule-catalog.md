# CRM Health Rule Catalog

Status: approved for Milestone 1 on 2026-10-17. Wording amended on 2026-10-19 under decision 0005 and on 2026-10-21 under decision 0011 to name Attio as the CRM; rule logic is unchanged, and `inspection-v1` still evaluates these rules against HubSpot-shaped records.

Frozen version: `health-rules-v1`

CRM health is determined by explicit rules. A model may summarize results later, but it does not decide whether a record passes a rule.

Each finding must include a stable rule ID, severity, affected record IDs, evidence, detected timestamp, rule version, proposed remediation, and automation safety classification.

## Severity definitions

- Critical: activation is prohibited until resolved.
- Warning: the record may remain visible, but a human should review the issue.
- Informational: the finding improves operations but does not block activation.

## Automation safety definitions

- Read-only: report the issue without proposing a write.
- Propose-only: show a specific change for human approval.
- Reversible: an approved write may run after the previous value is stored.
- Manual-only: the application must not perform the correction.

## Identity and association rules

### `CRM-COMPANY-001`: Duplicate canonical company domain

Critical. Two or more active company records resolve to the same normalized root domain without an approved identity override. Report the candidate group; merging is manual-only.

### `CRM-COMPANY-002`: Company missing trustworthy domain

Critical for scoring and activation. The record may be sent to Clay only if it is otherwise an eligible target candidate. Domain acceptance is propose-only.

### `CRM-CONTACT-001`: Contact without associated company

Critical. Association is propose-only when a unique company can be supported by verified evidence; otherwise manual-only.

### `CRM-DEAL-001`: Open deal without associated company

Critical. Manual-only because an incorrect association can change account treatment and reporting.

### `CRM-CONTACT-002`: Duplicate contact email

Critical. The records share the same normalized email. The system reports the group and suppresses all members pending manual resolution.

## Ownership and process rules

### `CRM-OWNER-001`: Open deal missing owner

Critical. The application may recommend an owner from an approved territory rule, but assignment is propose-only.

### `CRM-OWNER-002`: Activation candidate missing owner

Critical. No contact may enter Lemlist or TitanX without an accountable CRM owner.

### `CRM-DEAL-002`: Stale open deal

Warning. An open deal has no logged sales activity within 14 calendar days and no future task. The proposed remediation is a rep review task, not an automated stage change.

### `CRM-DEAL-003`: Open deal without next step

Warning. The deal lacks a non-empty next-step value and has no future task. The system may propose a task but cannot invent the commercial next step.

### `CRM-ACTIVITY-001`: Completed follow-up without disposition

Warning. A completed call or outreach activity lacks an accepted outcome. Correction is manual-only unless the connected system supplies a mapped disposition event.

## Lifecycle and suppression rules

### `CRM-SUPPRESSION-001`: Customer in prospecting audience

Critical. A company marked current customer, or a contact associated with it, appears in a proposed outbound audience. Removal from the application audience is automatic and does not alter the CRM lifecycle or customer status.

### `CRM-SUPPRESSION-002`: Open opportunity in prospecting audience

Critical. A company with an open deal appears in a proposed outbound audience. The company remains blocked until the deal closes or an explicit approved exception exists.

### `CRM-SUPPRESSION-003`: Email unsubscribe conflict

Critical. The contact qualifies for email by fit but has an unsubscribe or global email-suppression signal. Suppression is permanent unless the CRM records a valid later consent event.

### `CRM-SUPPRESSION-004`: Do-not-call conflict

Critical. The contact qualifies for calling but is marked do-not-call or globally suppressed. The application must not place the contact in the controlled TitanX calling List.

### `CRM-LIFECYCLE-001`: Invalid lifecycle progression

Warning. A record's lifecycle state contradicts the approved progression or associated commercial evidence. Report only; lifecycle changes are manual-only.

## Completeness and freshness rules

### `CRM-DATA-001`: Missing approved persona

Critical for activation. Clay may enrich title or role, but persona mapping follows a versioned deterministic map and uncertain results require review.

### `CRM-DATA-002`: Missing serviceable geography

Critical for scoring and calling. Clay may propose geography. Activation remains blocked until the company is confirmed inside the service area.

### `CRM-DATA-003`: Missing location-count band

Warning. Clay may supply a value with provenance and confidence. Missing location count reduces contextual score confidence but does not create a hard ICP failure.

### `CRM-DATA-004`: Stale contact data

Warning. No logged activity or verified enrichment refresh exists within 90 calendar days. The contact may be re-enriched but cannot have a verified channel asserted from stale data.

### `CRM-DATA-005`: Invalid or unverified email

Critical for email activation. A contact may remain phone-eligible if all phone requirements pass.

### `CRM-DATA-006`: Missing usable phone

Critical for phone activation. A contact may remain email-eligible if all email requirements pass.

## Cross-system rules

### `XSC-SYNC-001`: External activity without CRM identity

Critical for feedback processing. A Lemlist or TitanX event cannot be matched to one canonical CRM contact. Store the event and route it to failure review without guessing.

### `XSC-SYNC-002`: Duplicate external event

Informational when safely ignored. The connector event ID or computed idempotency key has already been processed.

### `XSC-SYNC-003`: Conflicting active channel

Critical. A contact is active in both Lemlist and TitanX despite the one-channel policy. Stop future automated steps where supported and request human review.

### `XSC-SYNC-004`: Interested response without owner follow-up

Warning initially; escalates operationally after the one-business-hour service-level agreement (SLA), meaning the team's internal response target. The system creates a visible rep task and alert but does not send a generated reply in version one.

