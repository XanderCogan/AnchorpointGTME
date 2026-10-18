# Planned Architecture

## Deployment shape

```text
Browser
  -> Vercel: Next.js dashboard
       -> Railway: TypeScript API
            -> Railway PostgreSQL
            -> Postgres-backed job queue
            -> Railway background worker
            -> Railway scheduled reconciliation jobs
            -> HubSpot, Clay, Lemlist, and TitanX handoffs
```

Vercel is the human interface. Railway is the integration and processing layer. HubSpot remains the operational system of record. PostgreSQL stores the application mirror, findings, proposals, approvals, job state, connector events, and audit evidence.

## Current repository shape

```text
Anchorpoint/
  apps/
    web/        authenticated Next.js read-only audit interface
    api/        bearer-protected HTTP API
    worker/     PostgreSQL-backed audit worker
  packages/
    core/       implemented audit types and deterministic rules
    contracts/  runtime fixture validation
    db/         schema, migrations, queries, repositories, and job state
  fixtures/     immutable synthetic inputs and expected outcomes
  tests/        executable acceptance evidence
  scripts/      inspection and artifact builders
  docs/
    product/    scope, architecture, milestones, collaboration
    contracts/  approved definitions, rules, scoring, and states
    research/   discovery, historical-data, ICP, and TAM work
    milestones/ implementation evidence and remaining work
    decisions/  durable product rationale
```

The current code path stores validated fixture input in PostgreSQL, runs the audit in a background worker, persists findings and job state, exposes them through a protected API, and renders them for an authenticated RevOps user. The complete local path is accepted against PostgreSQL, including retry exhaustion and authenticated desktop and narrow-viewport QA. Preview deployment remains pending. Connector packages are not implemented.

## Planned repository shape

```text
Anchorpoint/
  apps/
    web/       Next.js dashboard deployed to Vercel
    api/       HTTP API and webhook receivers deployed to Railway
    worker/    background jobs deployed to Railway
  packages/
    core/      health rules, scoring, suppression, and state transitions
    db/        schema, migrations, queries, and repositories
    connectors/ HubSpot, Clay, Lemlist, and TitanX adapters
    contracts/ shared validated request and event schemas
  fixtures/    synthetic connector inputs and expected outcomes
  docs/        routed product, contract, research, milestone, and decision records
```

The folders beyond `docs/` will be created only when their milestone begins.

## Service responsibilities

### Web application

- CRM health overview and evidence
- Record-level issue inspection
- Play table and scoring explanation
- Approval queue
- Rep work queue
- Integration and job status
- Audit-history display

### API

- Authenticated dashboard endpoints
- HubSpot and Lemlist webhook receivers
- Clay callback receiver
- Approval commands
- Connector credential boundaries
- Health and deployment checks

### Worker

- Paginated HubSpot synchronization
- Health-rule evaluation
- Clay enrichment requests and result processing
- Account score recalculation
- Lemlist enrollment
- HubSpot list and property updates for TitanX handoff
- Retry, dead-letter, and reconciliation processing

### Database

- Source-object mirror with source identifiers and timestamps
- Health findings and evidence
- Scoring inputs, score versions, and explanations
- Suppressions and activation eligibility
- Approval decisions
- Connector events and idempotency keys
- Proposed and completed mutations
- Before-state snapshots and audit events

## Connector boundaries

HubSpot is read first. Writes are limited to explicitly approved properties, activities, and list membership. Clay receives bounded enrichment requests and returns structured fields. Lemlist receives approved email-ready contacts and returns activity events. TitanX is initially reached through a HubSpot segment and its supported HubSpot integration rather than an assumed private API.

## Reliability requirements

- Validate every external payload at the boundary.
- Store each inbound event before processing it.
- Make every job idempotent.
- Retry transient failures with bounded backoff.
- Send exhausted jobs to a visible failure queue.
- Prevent concurrent syncs for the same connection.
- Reconcile connector state on a schedule instead of trusting webhooks alone.
- Never mark an external action complete before recording its external identifier.

