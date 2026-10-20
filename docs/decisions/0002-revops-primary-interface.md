# Decision 0002: RevOps-Primary Interface

Status: approved for Milestone 2.

Date: 2026-10-18  
Decision owner: User  
AI role: researched the engagement archetype and translated the decision into the product hierarchy

## Question

Should the first application interface be designed primarily for a CRO, a RevOps operator, an SDR, or separate role-specific experiences?

## Decision

The Milestone 2 CRM-audit interface is RevOps-primary.

The CRO and private-equity sponsor are oversight users who need concise readiness, risk, ownership, and progress summaries. Sales managers become approval users, and business-development or service-sales representatives become downstream work-queue users as those capabilities arrive in later milestones.

## User rationale

Anchorpoint is a fictional private-equity-backed roll-up that has combined several regional fire-and-life-safety operators. The immediate problem is getting acquired operations onto a coherent commercial system before scaling outbound, so the person resolving identity, ownership, process, and data-quality conflicts is the natural first user.

Representatives benefit from the system, but they should receive approved, usable work rather than operate the underlying CRM-remediation and integration layer. Leadership sponsors the change and monitors readiness without becoming the daily operator.

## Rejected alternatives

A CRO-primary interface would overemphasize aggregate reporting before the operational foundation exists. An SDR-primary interface would frame the product as a prospecting tool and obscure the post-acquisition standardization problem. Building full role-specific interfaces during Milestone 2 would expand scope before the shared application path is established.

## Consequences

- The first dashboard prioritizes evidence, ownership, remediation, filtering, and failure investigation.
- Executive summaries remain compact and do not displace the operator workflow.
- The Milestone 5 play table and approval workflow serve sales managers.
- The Milestone 8 work queue serves business-development or service-sales representatives.
- The operational CRM (Salesforce under decision 0005; HubSpot for the frozen `inspection-v1` fixture) remains the system of record rather than being replaced by this application.
- The demo narrative begins with post-acquisition commercial standardization, then shows safe outbound enablement and handoff.

## Implementation status

The existing findings board already approximates an operator workbench. Desktop and narrow-viewport browser QA is the next Milestone 2 task; its information hierarchy should now be evaluated from the RevOps perspective.
