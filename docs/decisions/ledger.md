# Decision Ledger

Status: maintained. Last checked against every decision record, `STATE.md`, and `docs/product/build-plan.md` on 2026-10-22.

This ledger exists so that nobody has to work out from sixteen separate records which one governs. Each record keeps its original text, including text that later records override. Where an older record still says something a newer one changed, that older text is historical and the newer record governs. Current status lives only in `STATE.md`; this ledger records which decision owns each answer, not what is built.

## 1. Decisions in order

### 0001 Soft targeting and change propensity

Status: active. Decided that ICP characteristics are soft prioritisation signals and that hard gates are reserved for safety, consent, identity, serviceability, ownership, and human approval. Replaced the rejected fixed-tier ICP model. Nothing has replaced it; decision 0009 builds beside it by keeping value separate from the priority score.

### 0002 RevOps-primary interface

Status: active. Decided that the Milestone 2 CRM-audit interface serves the RevOps operator first, with the CRO and sponsor as oversight users and representatives as later work-queue users. Replaced no earlier record. Nothing has replaced it. Its consequences name Salesforce under decision 0005 as the operational CRM; that phrase is historical and decision 0011 governs.

### 0003 Service catalog, branch footprint, licensing, and travel time

Status: active; amended on 2026-10-20 to add subcontracted large sprinkler work and fire door and firestopping lines. Decided what Anchorpoint sells, from which four branches, under which licences, and within which drive-time bands. Replaced no earlier record. Nothing has replaced it. Its consequence about the historical dataset already notes that no history is generated under decision 0010.

### 0004 Fictional operating source system reconciled with the CRM

Status: active for its reconciliation rules; its fixture-release consequence is overridden by decision 0010 without an amendment in the record itself. Decided that a ServiceTrade-shaped field-service export, not the CRM, is the truth for who is a customer, and how FSM records match CRM records. Replaced no earlier record. Decision 0010 cancelled the fictional FSM fixture it expected; decision 0011 moved its CRM side from Salesforce to Attio. See section 2.

### 0005 Salesforce as the CRM system of record

Status: superseded by decision 0011 on 2026-10-21. Decided that Salesforce would replace HubSpot as the CRM for all work after Milestone 2, with a CRM-neutral core and a mapping layer. Replaced the HubSpot assumption in the contracts and `inspection-v1`, which stays frozen as HubSpot-shaped. Replaced by decision 0011, which kept the CRM-neutral core and mapping-layer approach and retargeted it to Attio. Its development-environment amendment had already been narrowed by decision 0010.

### 0006 Ordinary-company operating profile

Status: active for the operating profile; partly cancelled by decision 0010 on 2026-10-20, which cancelled the "Generated dataset scope" section and the two consequences that depended on generated history. Decided Anchorpoint's size, revenue mix, retention, and data-quality shape as labelled assumptions. Replaced no earlier record. Decision 0009 consumes the profile; decision 0010 removed the dataset it was written to generate.

### 0007 First Georgia segment sample and enrichment budget

Status: active; amended four times. The enrichment budget went from a $300 cap to $0 on 2026-10-19, to $20 for Clay plus $20 for one other service on 2026-10-20, and the same day to allowing Clay spend beyond $20 under the one-day timeline with each purchase confirmed at the shown price. The personal data boundary was amended on 2026-10-22 under decision 0012 so that work emails and mobile numbers live in Attio as People. Decided that senior living and skilled nursing is the first Georgia sample, which sources build it, and how much enrichment spend is allowed. Replaced no earlier record. Nothing has replaced it; decision 0012 keeps budget limits as one of the two constraints that survive the run-as-a-real-company amendment.

### 0008 Parallel historical-fixture and market-sample tracks

Status: partly cancelled on 2026-10-20: Track A, the historical fixture and its Salesforce org load, is cancelled and its text is kept for history only; Track B, the Georgia sample alongside Milestone 3, is active. Decided that the Georgia sample could run in parallel with Milestone 3 as the first exception to the build plan's review-before-next rule. Replaced the strict one-milestone-at-a-time order for Milestone 4's data work. Its join point was replaced by decision 0010; its "Unchanged order" section for Milestones 5 to 7 was replaced by decision 0012; its Salesforce org precondition was replaced by decisions 0010 and 0011.

### 0009 Account value model

Status: active; its calibration items stay open. Decided that account value is a second number beside the priority score, computed from certified beds and assumed prices, never folded into the score. Replaced no earlier record. Nothing has replaced it.

### 0010 No fictional CRM history; real market, proven analysis tools

Status: active. Decided that no fictional deals, activities, customers, or campaign history are created anywhere, that the CRM holds real Georgia operators and facilities only, and that ICP hypotheses come from public evidence and labelled assumptions. Replaced the cancelled Track A of decision 0008, the generated-dataset section of decision 0006, the development-environment amendment of decision 0005, and the Milestone 4 historical dataset. Nothing has replaced it; decision 0011 states explicitly that it is unchanged and carries it to Attio.

### 0011 Attio replaces Salesforce as the CRM system of record

Status: active; its three open items stay open, and the TitanX half of the first open item is moot under decision 0014. Decided that Attio is the CRM for all work after Milestone 2, with the same CRM-neutral core and mapping-layer approach. Replaced decision 0005. Nothing has replaced it. Its line "Railway PostgreSQL stays" is historical; decision 0013 governs hosting.

### 0012 Build Milestones 5 to 7 early on practice fixtures

Status: active; amended on 2026-10-22 twice, first to state that no email is ever sent and no call is ever placed, then to run Anchorpoint as a real company with automated Attio writeback under the operating contract's write policy. Decided that Milestones 5, 6, and 7 are built in parallel with 3 and 4 on labelled practice fixtures, and that the system stops at the handoff point forever. Replaced the "Unchanged order" section of decision 0008 and the per-write approval pattern for Attio writes. Nothing has replaced it; decision 0014 narrows what Milestone 7 connects to.

### 0013 Render replaces Railway for the API, worker, and database

Status: active and carried out. Decided that Render hosts the API, worker, and PostgreSQL 17 after Railway's 2026-10-21 security incident, with Vercel still serving the web application and every Railway secret rotated. Replaced the Railway hosting assumed in the build plan's Milestone 2 and the "Railway PostgreSQL stays" lines in decisions 0005 and 0011. Nothing has replaced it.

### 0014 No paid dialer; the call handoff ends at an Attio List

Status: active. Decided that no dialer subscription is bought and that Milestone 7 ends at the controlled Attio List any dialer would read, with TitanX still the named planned calling system and Allo the unconfirmed fallback. Replaced the assumption in decisions 0011 and 0012 that TitanX would be connected and might need an Attio bridge. Nothing has replaced it.

### 0015 Campaign-level approval and native Lemlist enrollment from Attio

Status: active. Decided that approval is per campaign, with automatic enrollment from an Attio audience List. Amended decision 0001's human-approval gate; decision 0016 follows from it.

### 0016 Milestone 5 collapsed to explainable scoring and the approval gate

Status: active. Redefined Milestone 5 around what decision 0015 left necessary, marked it complete on fixtures, and moved the approvals table and operator page to Milestone 8. Amends the build plan; replaces no decision.

### 0017 Per-email review only for band A

Status: active. Within an approved campaign, model-drafted emails carry into Lemlist on the campaign approval alone; a person reads each draft only for band A operators. The approvals file also applies to the practice source. Extends decision 0015; replaces no decision.

## 2. Checked for contradictions

Each pair below was read side by side. "Consistent" means the newer record states that it changes the older one or the two agree. A conflict is quoted with its file name.

### CRM choice: 0005 and 0011

Consistent. `0005-crm-system-of-record.md` carries "Status: superseded on 2026-10-21 by decision 0011", and `0011-attio-crm-system-of-record.md` says "This supersedes decision 0005". Older records that still name Salesforce as the CRM are historical: `0002-revops-primary-interface.md` ("Salesforce under decision 0005"), `0004-operating-source-system.md` ("The CRM is Salesforce under decision 0005"), `0007-first-georgia-sample-and-enrichment.md` ("follow the Salesforce mapping in decision 0005"), and `0008-parallel-data-tracks.md` ("Milestone 3, the read-only Salesforce connection"). Decision 0011 governs each of them. The line "Salesforce was introduced at the platform in 2023" in `0006-ordinary-company-profile.md` is part of the fictional company profile and describes Anchorpoint's imagined past, not the project's CRM; it is harmless but historical.

### Fictional data: 0006, 0008, and 0010

Consistent among the three. `0006-ordinary-company-profile.md` says the "Generated dataset scope" section "is cancelled and kept for history only", `0008-parallel-data-tracks.md` says "Track A is cancelled", and `0010-no-fictional-crm-history.md` is the record that governs. One older record was not amended and still conflicts in wording: `0004-operating-source-system.md` says "A new immutable fixture release will carry the FSM export alongside Salesforce-shaped CRM records", and its question speaks of "the historical dataset". That fixture would hold fictional jobs, invoices, and contracts, which `0010-no-fictional-crm-history.md` forbids with "No fictional deals, activities, customers, or campaign history are created, in the Salesforce org or anywhere else." The 0004 text is historical; decision 0010 governs, and no FSM fixture release exists (`fixtures/releases/` holds only `inspection-v1`, `salesforce-mapping-v1`, and `attio-mapping-v1`). The reconciliation rules in 0004 remain active as rules to apply if a client's FSM export ever arrives.

### Hosting: 0013 against earlier Railway mentions

Consistent in substance; two older lines are overridden. `0005-crm-system-of-record.md` says "Railway PostgreSQL stays until a separate infrastructure decision", and `0013-render-replaces-railway.md` is that decision. `0011-attio-crm-system-of-record.md` says "Railway PostgreSQL stays. Supabase remains out of the plan." The Railway half is historical and decision 0013 governs; the Supabase half still holds. In `docs/product/build-plan.md`, Milestone 2 still instructs "Deploy the web application to Vercel and the backend services and PostgreSQL to Railway" and its status line says "The Vercel and Railway preview is deployed". The status line is historical evidence, which decision 0013 explicitly leaves unrewritten. The instruction sentence is stale and is not corrected here because this ledger touches no other file; decision 0013 and the hosting line in `STATE.md` govern.

### Dialer: 0014 against TitanX mentions in 0011 and 0012

Consistent, with one moot item and one phrase to read carefully. `0011-attio-crm-system-of-record.md` leaves open "Whether Lemlist and TitanX integrate with Attio natively or need the application to bridge them", and `0012-early-activation-build-on-fixtures.md` repeats that this "still needs one bounded lookup each. It shapes the Milestone 7 bridge". Under `0014-no-paid-dialer.md`, "nothing connects to it", so the TitanX half of that lookup no longer needs doing; the Lemlist half was answered by building the Attio-to-Lemlist feed. Decision 0012 also says "The Attio List that TitanX would read is built and proven, but no dialing is ever started from it." That sentence states the rule for Milestone 7, not its status: `STATE.md` records that Milestone 7 has "no code yet" and that the Attio List is deferred to the gap statement. `STATE.md` governs status. Decision 0014's own line, "TitanX stays named as the planned calling system, but nothing connects to it", matches 0012's "TitanX never places a call" and the build plan's Milestone 7 text.

### Enrichment budget: 0007 and its amendments

Mostly consistent, with one internal contradiction and one overtaken plan. The status line of `0007-first-georgia-sample-and-enrichment.md` records each amendment, and the budget section's own amended line, "Clay spend may exceed $20 when the free plan cannot finish the pass", agrees with it. The unamended sentence "Phone enrichment is excluded" in the same budget section conflicts with the 2026-10-22 amendment in the personal data boundary, "work emails and mobile numbers found by Clay are stored in Attio as part of People records", and with `STATE.md`, which records a Mobile Phone Number column at about 10 credits a person and phone numbers on the writeback whitelist. The later amendment and `STATE.md` govern: phone enrichment is allowed within the budget rules. Separately, `0012-early-activation-build-on-fixtures.md` says "Clay is no longer run by hand" and "This needs a paid Clay plan", while `STATE.md` records "a script-driven CSV round trip, since the user will not pay for Clay Growth" and "The user only imports and exports one CSV in Clay". The 0012 text describes the intended path; the budget limit that 0012 itself preserves won, and `STATE.md` governs how the loop runs. `0008-parallel-data-tracks.md` restates "$20 for Clay and $20 for one other service"; that is the budget as it stood on 2026-10-19 and the later 0007 amendments govern.

### Gate order: the build plan against 0008 and 0012

Consistent. `docs/product/build-plan.md` names "two exceptions", the Georgia sample alongside Milestone 3 under decision 0008 and Milestones 5, 6, and 7 built early under decision 0012. The "Unchanged order" section of `0008-parallel-data-tracks.md`, which says "Milestones 6 and 7 still follow Milestone 5" and "This decision does not reorder Milestones 6 and 7", is historical; `0012-early-activation-build-on-fixtures.md` records that the review-before-next rule "gains a second exception, alongside decision 0008" and governs. Decision 0008's consequence "Milestone 3 cannot start until the user creates the Developer Edition org and the first historical release is loaded" is also historical: decision 0010 removed the historical release and decision 0011 removed the Salesforce org, and `STATE.md` records Milestone 3 as accepted on Attio.

## 3. Governing today

- CRM: Attio, decision 0011. `inspection-v1` stays HubSpot-shaped and frozen; Salesforce code is superseded reference.
- Hosting: Render for the API, worker, and PostgreSQL 17, with Vercel for the web application, decision 0013. Railway is deleted; Supabase is out of the plan.
- Dialer: none bought, decision 0014. Milestone 7 ends at the Attio List; TitanX is the named planned system only.
- Outreach: never, decision 0012 as amended. No sending domain, mailbox, launched campaign, or dial.
- Fictional data: none, decision 0010. The CRM holds real Georgia operators and facilities only; synthetic fixtures are labelled test inputs.
- Enrichment budget: decision 0007 as amended, kept in force by decision 0012. Free tiers first, Clay may exceed $20 under the one-day timeline, and every purchase is confirmed at the shown price.
- Gate order: the build plan, with its two exceptions under decisions 0008 and 0012 and the Milestone 5 redefinition under 0016. Milestones 5, 6, and 7 are accepted on dry runs, fixtures, and handoff records.
- Approval: campaign-level, decision 0015. A manager approves a campaign, its audience definition, and its senders once; enrollment is automatic from an Attio List through the native Lemlist app. Suppression stays deny-first and no outreach ever happens. Per-email review of model drafts is limited to band A operators, decision 0017.
