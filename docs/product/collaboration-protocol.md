# Collaboration Protocol

Status: active working agreement.

## Purpose

This project must demonstrate the user's GTM judgment and technical understanding, not merely that an AI can generate a repository. The user does not need to memorize generated explanations. The repository must preserve why decisions were made, and the build process must require the user to apply those decisions to new cases.

## Division of responsibility

The user owns:

- Business definitions
- Targeting philosophy
- Expected behavior for ambiguous scenarios
- Approval and suppression policy
- Tool configuration choices
- Acceptance of milestone outputs
- Explanation of tradeoffs to a nontechnical stakeholder

Codex owns:

- Scaffolding and repetitive implementation
- Presenting options and consequences
- Turning approved decisions into code and tests
- Finding contradictions and failure cases
- Running verification
- Keeping documentation synchronized

Ownership does not mean working alone. Codex can teach, suggest, and review; it must not silently make customer-specific decisions and then ask the user to memorize them.

## Scenario before code

Every meaningful rule begins as a plain-language scenario. Before Codex implements it, the user states what should happen and why.

Example:

> A newly hired procurement leader at a 190-person company may deserve attention before a 1,000-person perfect-fit account with no change signal. The smaller company must not be excluded by an employee cutoff.

That answer becomes an expected outcome. Code is then judged against the outcome rather than the other way around.

## Decision receipts

Material product decisions receive a short record under `docs/decisions/` containing:

- The question
- Decision owner
- Decision
- Rationale
- Rejected alternative
- Product and test consequences
- Implementation status

This provides evidence of judgment without pretending every line of code was manually typed by the user.

## One vertical slice at a time

Each milestone is divided into small end-to-end slices. For every slice:

1. Codex presents the user-visible problem and relevant raw data.
2. The user predicts the correct result in plain English.
3. Codex explains the smallest implementation needed.
4. The user completes one hands-on task.
5. Codex implements or completes the surrounding plumbing.
6. Tests run against the user's expected result.
7. The user explains the result and one failure mode before the slice closes.

## Required user hands-on work

The user's work should be operationally meaningful rather than artificial typing.

### Application foundation

- Choose the first dashboard workflow and information hierarchy.
- Trace one request from the browser through the API to stored data.
- Change one validation rule or query with guidance and verify its test.

### HubSpot connection

- Configure the development portal and read-only app permissions.
- Map the real portal's properties to the canonical contract.
- Classify at least ten ambiguous records and explain the treatment.

### Clay enrichment

- Build or configure one enrichment path.
- Decide how conflicting enrichment and human-entered CRM values are handled.
- Inspect provenance and failure results rather than accepting the happy path.

### Scoring and approval

- Own the scoring weights and decay behavior.
- Rank a sample manually before seeing the computed ranking.
- Challenge at least one result and decide whether the data, contract, or implementation is wrong.

### Lemlist

- Configure the sandbox campaign and suppression behavior.
- Approve a dry run.
- Demonstrate that a duplicate request does not enroll a contact twice.

### TitanX

- Map call dispositions to next actions.
- Decide which outcomes stop, continue, or defer the play.
- Inspect one ambiguous disposition and document the handoff.

### Final handoff

- Give the live walkthrough.
- Diagnose a seeded failure without a prepared script.
- Explain what the system deliberately refuses to automate.

## Explain-back gate

Before a milestone closes, the user should be able to explain, with the repository open:

- What problem the milestone solves
- The important inputs and outputs
- One business definition that could have been different
- One failure mode
- One guardrail
- How the implementation was verified

Using documentation is allowed. The goal is reconstruction and understanding, not memorization.

## Authorship standard

It is acceptable to say that AI generated or accelerated code. The portfolio claim is that the user directed the product, supplied and revised business semantics, validated outcomes, configured the operating tools, and can maintain and explain the system.

