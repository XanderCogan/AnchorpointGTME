# Case Study: Portco Launch Control

Status: written 2026-10-23 as a one-page summary of the work sample. Current status lives in `STATE.md`; the long form is `docs/portfolio/methodology.md`.

## The situation

Anchorpoint Fire & Safety is a fictional private-equity-backed fire and life-safety operator with a platform branch in Norcross, Georgia and add-ons in Macon, Savannah, and Greenville. It has just rolled up four branches and wants to scale outbound. Before it can, someone has to answer three questions: which accounts are worth the reps' time, which people at those accounts matter, and what the CRM must look like so the answers are trustworthy. The client is invented and labelled as such. Its market is real: Georgia senior-living and skilled-nursing facilities, sourced from public CMS records with retrieval dates.

## The approach

I followed the data-foundation order, not the outreach order. Map the market, resolve facilities to the operators who buy, decide what Anchorpoint can actually service, tier what is left, find the people, and only then design activation. Every step is a script that can be rerun, and every rule is written down before it runs.

Three choices shaped the work.

- Soft targeting over hard ICP tiers. Firmographics contribute gradually; the only hard gates are safety, consent, identity, serviceability, ownership, and human approval. A recent role change is worth more than a perfect-fit account with no reason to act.
- A real market and no fictional history. A made-up CRM can only rediscover the ICP written into it, so the method had to hold up against records I did not control.
- Safety built in, not bolted on. The sync connector is read-only, writeback fills empty fields only and routes conflicts to review, enrollment needs a recorded human approval, suppression is deny-first, and a kill switch exists. No email was ever sent and no call was ever dialed.

## What was built

- 356 Georgia nursing homes resolved to 105 operators, with every ambiguous merge sent to a review list rather than guessed. Two review batches brought 41 open cases down to five.
- Serviceability from road drive times to the nearest licensed branch, leaving 71 operators in footprint.
- An explainable score under a frozen contract, giving 6 Tier A, 15 B, 32 C, and 18 Watch, with a separate value estimate that never leaks into the score.
- Attio as the CRM, with Companies for operators, a custom Site object so facilities never count as accounts, People linked to Companies, and Lists as the only activation audience.
- A Clay people pass over four role slots, proven end to end on two operators. PruittHealth, the top Tier A target with 41 facilities in footprint, went from CMS rows to domain, address, and five People in Attio with every uncertain item queued for review.
- A Lemlist connector with an enrollment ledger, kill switch, and webhook receiver, verified against the real API. One labelled practice contact was drafted, reviewed, and enrolled in a campaign that has no sender and was never launched.
- Hosting on Vercel and Render, with a monthly cron that refreshes the CMS pull, scoring, and Attio load. The first live run passed all eight stages in six minutes.

## What was left

The project was scoped to one day and ran to three. Clay ran on free credits, so 70 of the 71 eligible operators are not enriched and 142 audit findings for missing domains and addresses remain open. No dialer was bought, so the call handoff ends at an Attio List. The rep work queue and approvals table are designed but not built. The gap statement in `docs/portfolio/gap-statement.md` names each item and what the next engineer does first.

## What it shows

A market can be sized and tiered from public records without inventing anything. A CRM can be loaded and audited by a pipeline that leaves a source and a reason on every row. And an activation path can be built to the edge of sending, with the approval, suppression, and reversal controls in place, before anyone decides to send.
