# Decision 0010: No Fictional CRM History; Real Market, Proven Analysis Tools

Status: approved by the user in conversation on 2026-10-20.

Date: 2026-10-20  
Decision owner: User  
AI role: mapped where the planning documents still assumed the cancelled Track A history, argued for and against a small fictional CRM set, and drafted this record

## Question

Track A, the generated 30-month Anchorpoint history, was cancelled on 2026-10-20 under the amendment to decision 0008. Several documents still depended on it: the Salesforce org's contents, the Milestone 4 historical dataset, and the method for deriving ICP hypotheses. What replaces it, and should a smaller fictional CRM set exist instead?

## Decision

### No fictional CRM history

No fictional deals, activities, customers, or campaign history are created, in the Salesforce org or anywhere else. A smaller hand-written or seeded set was considered and rejected.

Analysing history the project generated itself is circular: it can only rediscover the ICP written into the generator. Fake records add a layer of guesses that look like facts, such as a "closed-won" amount that points to no evidence. The TAM's honesty rests on keeping two layers apart: facts with a public source, and assumptions that are labelled, versioned, and individually challengeable.

### The Salesforce org holds real market records only

The Developer Edition org holds the real Georgia operators and facilities from the market sample as Accounts and Sites. Contacts follow the personal data boundary in decision 0007. The Opportunity, Task, Campaign, and Lead objects may be empty. Milestone 3 proves those objects through synthetic recorded responses in `fixtures/connectors/`, which are labelled test inputs and never findings.

### ICP hypotheses come from public evidence and labelled assumptions

Without real outcome history, ICP hypotheses come from public evidence on real records, such as fire-safety citations, chain size, ownership changes, hiring, and drive time, combined with the approved tiering and the value model in decision 0009. The project does not claim to have discovered an ICP from history.

### CRM history analysis is shown as a ready capability

The project still demonstrates that a client's real CRM could be analysed. Milestone 4 replaces the historical discovery dataset with:

- `docs/research/crm-icp-analysis-playbook.md`, the method a GTM engineer would run on a client's Salesforce, including what to distrust and what to ask sales; and
- an analysis pipeline over the read-only Salesforce mirror, joined to the market tables, verified on labelled test fixtures whose outputs are never presented as findings.

### The Georgia sample is one deliberate slice of several

Senior living and skilled nursing is the first of about five Georgia segments, chosen because it alone has public, dated fire-safety citation evidence. A coarse sizing pass covers the other segments with a public establishment count, a rough value per site, and the available signals, so the choice of first slice is documented rather than implied. The nursing-home work is presented as the deep dive a single slice would normally receive.

## Consequences

- Decision 0006 keeps its operating profile, which decision 0009 uses, and its generated-dataset section is cancelled.
- Decision 0008's join point, which waited on Track A's historical dataset, no longer applies. ICP drafting waits only on the Georgia sample and the segment sizing pass.
- The build plan's Milestone 3 and Milestone 4 sections, the TAM construction plan, the operating contract's write policy, the Apero portfolio narrative, and the Georgia sample plan's load stage are revised to match.
- Current-customer suppression has no real customers to act on in this project. It stays implemented and tested on fixtures.
- No write-capable loader for fictional history is needed. Loading real Accounts and Sites into the org remains a separate setup step from the read-only connector.

## Rejected alternatives

- A small fictional set drawn from decision 0006's distributions with a recorded seed. It would have exercised every Salesforce object in the org and let demo views show customer suppression. It was rejected because thirty deals are not a distribution, a fictional customer flag could change which real operators appear as targets, and fixtures already cover the plumbing.
- Keeping the historical dataset as deferred work. Undated deferred work is how stale plans accumulate.
