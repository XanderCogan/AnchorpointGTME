# Product Brief

## User

The primary application user is the RevOps or GTM-operations owner responsible for standardizing the commercial system and preparing the portfolio company for outbound. CRO and private-equity sponsor users need oversight and readiness summaries; sales managers review and approve target plays; business-development or service-sales representatives work approved replies, calls, and follow-ups.

For the Milestone 2 CRM-audit interface, RevOps is the primary perspective. Later milestones add manager approval and representative work queues without turning the application into the sales team's primary CRM.

## Problem

Teams often add outbound volume before they have a maintained CRM, an accepted target market, usable contact data, or safe sending and calling processes. Representatives then waste time researching bad records, contacting customers, duplicating work, and guessing what to do next.

## Promise

Portco Launch Control tells the operator what is broken, which accounts deserve attention, why they were selected, whether they are ready for outreach, and what the next human action should be.

## Core workflow

1. Read companies, contacts, deals, owners, associations, and relevant activities from HubSpot.
2. Evaluate CRM health using explicit deterministic rules.
3. Send only approved incomplete target records to Clay for enrichment.
4. Score and tier accounts using visible customer-approved rules.
5. Suppress customers, open opportunities, unsubscribed contacts, duplicate records, and contacts with unresolved data risks.
6. Present the proposed play to a manager for approval.
7. Route email-ready contacts to Lemlist and phone-ready contacts to a HubSpot segment used by TitanX.
8. Return replies, bounces, calls, dispositions, meetings, and follow-ups to HubSpot and the application work queue.

## CRM health model

The first version does not use machine learning or an LLM to determine record health. Each check has a stable identifier, severity, affected object type, evidence, remediation, and automation safety classification.

Initial checks include:

- Contact without an associated company
- Missing contact or deal owner
- Duplicate company domain
- Customer or open opportunity in a prospecting audience
- Open deal without a next step
- Open deal without recent activity
- Missing domain, persona, email, or phone
- Invalid lifecycle progression
- Outreach activity without a matching CRM record
- Unsubscribe or suppression conflict

An LLM may later summarize verified findings, but it must not invent findings or silently change scores.

## First demonstration

Use one fictional portfolio company with approximately 200 companies and 600 contacts. Support one ICP, one scoring model, one Lemlist campaign, one TitanX call segment, one manager, and two representatives.

## Out of scope

- Building a dialer
- Building a general-purpose AI SDR
- Multiple portfolio companies or tenants
- Autonomous deletion or merging of CRM records
- Unreviewed campaign launches
- Billing and subscription management
- Claims that synthetic demo activity represents real performance

## Safety boundaries

- Read-only by default
- Separate read and write credentials
- Human approval before external activation
- Preview of every proposed CRM mutation
- Stored previous values for reversible property updates
- Idempotency protection for every enrollment and webhook
- Immutable audit history
- No automated deletion
- Suppression always wins over activation
- Already-sent messages are never described as reversible

