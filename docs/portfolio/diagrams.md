# Diagrams

Status: portfolio reference, 2026-10-22. Status facts come from `STATE.md`; object and field names come from the code under `packages/connectors/src/attio/`, `packages/core/src/attio-mapping.ts`, `scripts/attio-load-georgia.ts`, and `scripts/clay-attio-mapping.ts`. Dashed nodes are steps that were never run or never built.

## 1. Data pipeline

```mermaid
flowchart TD
    cms["CMS Provider Data Catalog pull (Provider Information, Ownership, deficiencies)"]
    review["Manual review decisions (operator sites, NPI registry, news, Serper)"]
    resolve["Operator resolution: chain_id, controlling owner, legal name"]
    serv["Serviceability: OSRM drive time from the Anchorpoint base"]
    tier["Tiering: 71 eligible of 105 operators (6 A, 15 B, 32 C, 18 Watch)"]
    load["Attio load: Companies and Sites, one-time script"]
    mirror["Read-only Attio sync to the Postgres mirror, audit runs there"]
    export["clay:export CSV: companies needing domain or location"]
    clay["Clay waterfall: domain, address, four role slots, mobile number"]
    import["clay:import: plan, review queue, then live writeback"]
    reviewq["Review queue: conflicts, uncertain matches, unverified personas"]
    writeback["Attio writeback: Company domain and location, People created"]
    score["Scoring and approval queue"]
    approve["Human approval per contact"]
    lemlist["Lemlist enrollment (built, never launched, no campaign sends)"]
    list["Attio List of approved phone-ready contacts (not built)"]

    cms --> resolve
    review --> resolve
    resolve --> serv --> tier --> load --> mirror
    load --> export --> clay --> import
    import --> reviewq
    import --> writeback --> mirror
    mirror --> score --> approve
    approve -. "never run on real contacts" .-> lemlist
    approve -. "no code yet" .-> list

    classDef unbuilt stroke-dasharray:6 4,stroke:#8a8a8a,color:#555,fill:#f7f7f7;
    class lemlist,list unbuilt;
```

The solid path is what has run. CMS rows were pulled on 2026-10-19 and resolved to operators with the help of dated review decisions, drive time from OSRM set serviceability, the tier script produced the bands, and a one-time script loaded 105 Companies and their facilities as Sites into Attio, where the read-only connector mirrors them into Postgres for the audit. The Clay round trip is a CSV in and a CSV out because the user declined to pay for Clay automation: `clay:export` wrote 105 companies, Clay enriched one proven row (Tift Regional), and `clay:import` wrote that row's domain, address, and four linked People back to Attio with two items in the review queue. Scoring exists only as a script with JSON output, and the approval queue is built on labelled practice fixtures. The dashed nodes are the boundary: the Lemlist connector, ledger, and kill switch are built and tested, but no campaign has ever been launched and no real contact enrolled, and the Attio List for the calling handoff has no code at all (decision 0014). Nothing in this pipeline sends an email or places a call.

## 2. Attio object model

```mermaid
erDiagram
    COMPANY ||--o{ SITE : "operates"
    COMPANY ||--o{ PERSON : "employs"
    COMPANY ||--o{ DEAL : "has"
    PERSON ||--o{ CALL : "logged_on"

    COMPANY {
        string name "loaded from operators.json"
        string domains "writeback fills when empty, multi-valued"
        string primary_location "writeback fills when empty, line_1 to country_code"
        string operator_id "loaded, resolver key"
        string operator_status "loaded, resolved or provisional"
        string tier_band "loaded, A B C Watch or Not eligible"
        number tier_score "loaded"
        number georgia_facility_count "loaded"
        string industry_segment "loaded, read by the audit"
        boolean target_candidate "loaded, read by the audit"
        string customer_status "read by the audit, not written"
        string owner "read by the audit, not written"
    }

    SITE {
        string name "loaded from facility-operator-links.json"
        string ccn "loaded, CMS CCN"
        string street_address "loaded"
        string city "loaded"
        string zip "loaded"
        string county "loaded"
        number certified_beds "loaded"
        string ownership_type "loaded"
        reference company "loaded, link to the operating Company"
    }

    PERSON {
        string name "writeback creates"
        reference company "writeback creates, link to an existing Company"
        string job_title "writeback"
        string email_addresses "writeback, work email, multi-valued"
        string phone_numbers "writeback, mobile number, multi-valued"
        string linkedin "writeback"
        string persona "writeback, only when the role slot verified"
        boolean persona_verified "writeback, suffixed slug persona_verified_7"
        string enrichment_source "writeback stamp, clay"
        string enrichment_date "writeback stamp, suffixed slug enrichment_date_3"
        boolean email_opt_out "read by the audit and Lemlist feed, suppression"
        boolean do_not_call "read by the audit, suppression"
        string email_status "read by the audit"
        string phone_status "read by the audit"
        string enrichment_verified_at "read by the audit"
        string lifecycle_stage "read by the audit"
        string owner "read by the audit"
    }

    DEAL {
        string name "read only"
        reference associated_company "read only"
        string stage "read only"
        string deal_type "read only"
    }

    CALL {
        string occurred_at "custom object calls, read only"
        string disposition "read only"
        reference person "read only"
    }
```

Company and Person are Attio's standard `companies` and `people` objects; Site and Call are custom objects with the default slugs `sites` and `calls` from `packages/connectors/src/attio/objects.ts`. Every attribute on Site, and the operator and tier attributes on Company, were written once by `scripts/attio-load-georgia.ts` and are never touched by writeback. The writeback path in `packages/connectors/src/attio/writeback.ts` is limited to two objects: on `companies` it fills `domains` and `primary_location` only when they are empty, and on `people` it creates a record linked to an existing Company and writes `name`, `job_title`, `email_addresses`, `phone_numbers`, `linkedin`, `persona`, `persona_verified`, `enrichment_source`, and `enrichment_date`. A conflicting human value, an uncertain employer match, a possible duplicate, or an unverified persona goes to the review queue instead. The workspace's suffixed slugs (`persona_verified_7`, `enrichment_date_3`) are translated through `ATTIO_WRITEBACK_SLUGS`. The suppression checkboxes `email_opt_out` and `do_not_call` are read by the audit mapping and the Lemlist feed but are never written by the application. Attio holds no Deals or Calls for the Georgia sample; those objects are mirrored because the audit rules read them, and decision 0010 forbids inventing any history for them.

## 3. Activation state machine

```mermaid
stateDiagram-v2
    [*] --> discovered

    discovered --> audit_blocked : critical CRM finding, audit engine
    discovered --> enrichment_eligible : passes suppression checks, audit engine
    enrichment_eligible --> enrichment_queued : submitted to Clay with idempotency key
    enrichment_queued --> enrichment_failed : retries exhausted or unusable data
    enrichment_queued --> scored : validated enrichment result, versioned scoring
    scored --> below_threshold : under the play threshold
    scored --> approval_pending : score and channel readiness pass

    approval_pending --> approved_email : human manager approves contact and campaign version
    approval_pending --> approved_phone : human manager approves contact and call play
    approved_email --> approval_pending : approval withdrawn before activation
    approved_phone --> approval_pending : approval withdrawn before activation
    approved_email --> approved_email : kill switch engaged, enrollment skipped
    approved_email --> active_email : Lemlist accepts the idempotent enrollment
    approved_phone --> active_phone : contact enters the controlled Attio List

    active_email --> engaged : positive reply or meeting
    active_phone --> engaged : connected qualified call
    active_email --> nurture : next action deferred
    active_phone --> nurture : next action deferred
    active_email --> disqualified : reviewed commercial reason
    active_phone --> disqualified : reviewed commercial reason
    active_email --> complete : play ended with disposition
    active_phone --> complete : play ended with disposition

    enrichment_eligible --> suppressed : higher-priority suppression signal
    approval_pending --> suppressed : customer or open opportunity signal
    approved_email --> suppressed : unsubscribe or do-not-call
    active_email --> suppressed : unsubscribe, kill switch stops future steps
    active_phone --> suppressed : do-not-call, future steps stopped

    engaged --> [*]
    nurture --> [*]
    disqualified --> [*]
    complete --> [*]
    suppressed --> [*]

    note right of approval_pending
        No external activation is allowed here.
        Only a human manager creates an approved state,
        recording user, time, score version, play version,
        and the proposed record set.
    end note

    note right of suppressed
        Reachable from any pre-activation or active state.
        Deny-first: unsubscribe and do-not-call override
        score, approval, and active state.
    end note
```

This is `activation-states-v1` from `docs/contracts/activation-state-machine.md`, applied to one contact within one play. The audit engine owns the first branch, the versioned scoring engine owns `scored` and `below_threshold`, and only a human manager can create `approved_email` or `approved_phone`. Connector acceptance, not job submission, creates an active state, and the same idempotency key can never produce a second external action. Approval can be withdrawn before activation; after Lemlist sends a message or a call completes, the event is historical and only future steps can be stopped. The kill switch is a code addition in `packages/connectors/src/lemlist/`: when engaged, every enrollment plan skips with `kill_switch` and the contact stays approved but inactive, which is the self-loop shown on `approved_email`. In practice the states have only been exercised on labelled practice fixtures: no contact has ever reached `active_email` or `active_phone` with real outreach, and `active_phone` has no code behind it yet.
