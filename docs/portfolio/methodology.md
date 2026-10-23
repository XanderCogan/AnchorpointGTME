# Methodology

Status: written 2026-10-22 as part of the finish plan. Current status lives in `STATE.md`; this document explains how the work was approached, not what is live today.

I built this repository as a work sample for a GTM engineering role at Apero Advisors. Apero's stated method starts with the data foundation: map the TAM, find the people, enrich and validate, tier and load, then run a signal layer on top. This document explains how I did each step, which decisions shaped the work, and what the constraints forced me to give up.

## 1. Framing the problem

The client is fictional on purpose and the market is real on purpose. Anchorpoint Fire & Safety is an invented private-equity-backed fire and life-safety operator with a platform branch in Norcross and add-ons in Macon, Savannah, and Greenville, South Carolina. Everything about Anchorpoint, from its branch capabilities to its $28 million revenue, is a labelled assumption. Everything about its market, the Georgia nursing homes, their operators, their fire-safety citations, and the people who run them, is sourced from public records with a retrieval date.

I chose that split because a fictional client with fictional history can only rediscover the ICP written into it. Real market data forces the method to hold up against records I did not control. The rule that follows is data integrity: no invented value lands in a field that holds sourced data, and no sourced field is overwritten with a guess.

The first user is a RevOps operator, not a CRO or an SDR. A roll-up's immediate problem is getting acquired branches onto one commercial system before scaling outbound, so the person resolving identity and data-quality conflicts comes first. The Milestone 1 and 2 audit engine, built on a synthetic HubSpot-shaped fixture, is supporting evidence, not the headline.

## 2. Constructing the TAM

I sized about five Georgia segments coarsely before going deep on any, using Census County Business Patterns establishment counts with registry counts where one exists. Senior living and skilled nursing went first because it alone has public, dated fire-safety citation evidence, public operator relationships, a multi-site structure where vendor sprawl lives, and buyers identifiable by role. The other segments are context only.

The facility universe comes from three CMS datasets: Provider Information for 356 Georgia nursing homes with beds, chain identifiers, and coordinates; Fire Safety Deficiencies for 3,482 citations with tag, severity, and correction date; and Ownership for owners and managers with roles and association dates. A source manifest records identifiers, dates, row counts, and checksums. The state registry of assisted living and personal care homes was never scraped, because the state site was broken on the day I checked and its robots rules disallow automated access, so the sample is nursing-home-only.

Parent and site resolution runs in order: CMS chain identifier, then an organizational owner with operational control that is corroborated by an ownership stake or a shared distinctive name word, then legal business name. Anything ambiguous goes to a review list rather than being merged. The first run resolved 356 facilities to 128 operators with 41 review cases. After two batches of review decisions, each filed with its evidence and source, the same facilities resolve to 105 operators with five cases open.

Serviceability applies the branch footprint from decision 0003. Each facility gets the nearest branch offering each service line, a road drive time from the OSRM demo server, and a state with its reason. Under 90 minutes is serviceable, 90 to 120 is conditional and needs manager approval, and over 120 is out. Licensing is a separate hard gate, so a site near Savannah is still unserviceable for sprinkler work because that branch has no licensed inspector. Of the 105 operators, 71 have at least one facility serviceable or conditional for sprinkler or alarm work. OSRM times are free-flow and may run slow; facilities near a band edge are treated as uncertain.

## 3. Tiering

Tiering is soft. Firmographics contribute gradually, with no cliffs, and the only hard gates are safety, consent, identity, serviceability, ownership, and human approval. The score follows the frozen `account-score-v1.1` contract, and every weight the contract left open sits in one labelled parameter block the user approved.

Change propensity uses ownership change, dated hiring, and service-line citations, each decaying with age. Operational need rewards footprint within 120 minutes on a smooth curve and the share of facilities cited for a relevant line, pulled toward the statewide rate so one cited building does not earn full marks. People inputs scored zero until the Clay pass, so the maximum before Stage 6 was 65 of 85. The role-change and persona points from the people pass were folded into the score on 2026-10-22, which moved Life Care Centers of America into band A and four operators from C to B.

Bands are A from 40, B from 30, C from 20, and Watch below. On the 105-operator list that gave 5 A, 12 B, 36 C, and 18 Watch before the people inputs were folded in, and 6 A, 15 B, 32 C, and 18 Watch after. Band A is PruittHealth, Journey Healthcare, Empire Care Centers, Ethica Health, Harborview Health Systems, and, since the people inputs were folded in, Life Care Centers of America. Whether Watch is a tier or an undecided bucket is still the user's call.

Value is a second number beside the score, never inside it. Each in-footprint site is worth an assumed $9,300 a year at 100 beds, scaled by beds to the power 0.7, with conditional sites at 75 percent. Five-year value is annual times 4.0, and landing value is the five-year value of the largest site, because chains are won one site at a time. A test checks that no value input changes a score or band. The queue orders by band, then by five-year value, and small single-site operators in C or Watch get rep time only when their site is within 60 minutes of a branch. All prices are assumptions to be replaced by measured deals.

## 4. Finding and enriching people

The Clay pass runs only on serviceable, tiered operators, band A first. The role map defines four slots mapped to approved personas: a facilities leader and an operations leader at the operator, and a maintenance director and an administrator at each site. Each slot fills the same scoring inputs, role change, person relevance, and persona and channel confidence, inside the contract's caps.

The credit math was planned before spending anything. Clay's verified facts were 100 free credits a month and about 0.5 credits per profile enrichment; the per-person search cost was an assumption to be read from Clay before the first run. Worst case for the whole pass was about 840 credits. The stopping rule runs whole operator and site rows only, stops when free credits run out, and asks before any purchase.

The first run, on 2026-10-22, spent 28.5 free credits and no money. Chain sites turned out not to be reachable by people search, since a city filter placed the same metro Atlanta person at every PruittHealth site, so multi-site operators are covered through operator-level roles. Of 25 operators, 19 had a domain and were searched; a facilities leader was found at 11 (4 persona-verified) and an operations leader at 9. Of 28 single sites, 11 were searched and an administrator was verified at 5. The channel check was not done. The coverage file keeps counts and flags only.

A deeper pass was proven end to end on one row. Tift Regional went through Clay's domain waterfall, company enrichment, four role slots, and one mobile number for about 14 credits, and the import wrote its domain, address, and four linked People to Attio with two review items. The remaining tables were not run, because about 55 free credits remained and the user did not approve more spend.

The personal data boundary is that the repository is public, so names, titles, profile links, emails, phones, and role start dates never enter git. They live in Clay and Attio, are shown only to authenticated users, and are deleted when the project ends. The reducer that writes the coverage file refuses to write anything shaped like an email, link, or phone number.

## 5. CRM design

Attio holds Companies for operators, a custom Site object for facilities so sites never count as accounts, and People linked to Companies, with Deals, Tasks, a custom call-log object, and Lists for controlled activation audiences. Suppression is explicit checkbox attributes on People.

The sync connector is read-only, with a token limited to read scopes, and syncs into a Postgres mirror where the audit runs. Repeated syncs change nothing in Attio. Writeback is a separate path under a standing write token. It fills empty fields only and sends conflicts with human-entered values, uncertain matches, unverified personas, and possible duplicates to a review queue. The Clay round trip is a scripted CSV export and import, because the free Clay plan excludes CRM integrations.

## 6. Activation design

No outreach ever happens. Enrollment requires a human approval that records the user, timestamp, score version, and record set, and approval can be withdrawn before anything external occurs. Suppression is deny-first: when Attio, Lemlist, or the planned dialer disagree, the most restrictive signal wins. The Lemlist planner decides every candidate before any write, in order: kill switch, missing email, suppressed address, suppressed domain, not approved, already enrolled, duplicate. The kill switch blocks enrollment locally, then pauses the campaign. The transport refuses any campaign with a sender attached, and no sending domain or mailbox exists, so nothing can be sent even by mistake. The call handoff ends at an Attio List of approved phone-ready contacts, with no dialer connected.

## 7. Decisions and why

Decision 0001 made ICP characteristics soft signals and reserved hard gates for safety, consent, identity, serviceability, ownership, and approval, replacing fixed ICP tiers with score thresholds as eligibility. The reason: a 201-employee company is no different from a 200-employee one, and a person who just moved into a role is likelier to drive change than a perfect-fit account with no reason to act.

Decision 0002 made the first interface RevOps-primary, rejecting CRO-primary, SDR-primary, and separate role interfaces, because the roll-up's first problem is commercial standardisation after acquisition.

Decision 0003 defined the service catalog, four fictional branches with uneven capabilities, state licensing as a hard gate, and 90 and 120 minute drive-time bands. It filled a gap rather than replacing anything. The reason: recurring inspection and maintenance is the common shape of a regional operator, and separating license gates from distance lets the system explain why a site is unserviceable.

Decision 0004 made a field-service platform shaped like ServiceTrade the operational truth, reconciled with the CRM through explicit match states, because the CRM in a roll-up is the weakest record of who is a customer. Its history model became moot under decision 0010; its reconciliation states still feed suppression.

Decision 0005 moved the CRM from HubSpot to Salesforce because private-equity operating companies commonly run Salesforce and switching was cheap before any history existed. Decision 0011 superseded it.

Decision 0006 fixed Anchorpoint's operating profile, each figure labelled sourced or assumed, because an ordinary company makes the system's judgment credible. Its generated-dataset section was cancelled under decision 0010; the profile feeds the value model.

Decision 0007 chose senior living and skilled nursing first and set the budget, which went from a $300 cap to $0, then to $20 for Clay and $20 for one other service, then to paying beyond the cap for speed with each purchase confirmed. The segment reason: public authoritative data, inspected fire safety, multi-site operators, and role-identifiable buyers.

Decision 0008 let a historical-fixture track and the Georgia sample run in parallel, replacing strict milestone sequencing, to remove idle time. Track A was cancelled the next day as low value for the work sample.

Decision 0009 kept account value beside the priority score rather than inside it, because the scoring contract deliberately rewards timing over size, and folding value in would let chains outrank accounts with real signals.

Decision 0010 removed all fictional CRM history, rejecting both Track A and a small seeded set, because analysing history the project wrote itself is circular and fake records put guesses where facts should be.

Decision 0011 replaced Salesforce with Attio. The reason, added to the record on 2026-10-22, is that I found Attio easy to work with and well integrated, and it dropped the Salesforce JWT and sandbox setup under the one-day timeline. That is my judgment, not a vendor comparison.

Decision 0012 built Milestones 5 to 7 early on labelled practice fixtures instead of waiting for earlier acceptance. Its question cites the one-day timeline; the record gives no further reason. Its amendments added no outreach ever and the scoped write policy in place of per-write approval.

Decision 0013 moved the API, worker, and database from Railway to Render after Railway's 2026-10-21 security incident. Every Railway secret was rotated rather than copied.

Decision 0014 bought no dialer and ended Milestone 7 at an Attio List, because no call is ever placed, so a dialer would add cost without changing what the system proves. Nooks was rejected on price.

## 8. What the constraints forced

No real client data. There is no closed-won history, so the ICP is hypotheses from public evidence rather than something discovered, and the CRM history analysis is a playbook and a fixture-tested pipeline, not findings. Current-customer suppression has no real customers to act on.

About $20 of Clay. The coverage pass ran on 28.5 free credits and kept counts only. The deeper pass that writes domains, addresses, people, and a mobile number to Attio is proven on one row, Tift Regional, not on the other 104 operators. The channel check never ran, and 23 rows without a domain were never searched. The Clay round trip is a hand-carried CSV, not a native integration.

No dialer. Milestone 7 has no code yet. Its disposition mapping can only be proven on fixtures, and the handoff is an Attio List that nothing reads.

One day to finish. Milestone 5 is a scoring script and JSON output, not a play table or approval interface. Milestone 8, the rep work queue, runbook, and reconciliation jobs, is not built. The assisted living registry was dropped rather than negotiated. Band edges, the value assumptions, and the near-the-jaws radius are uncalibrated. Milestones 5, 7, and 8 are designed and not built, and I would rather say that plainly than describe a plan as a result.
