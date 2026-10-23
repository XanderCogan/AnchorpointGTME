# Case Study: Portco Launch Control

Status: written 2026-10-23 as a one-page summary of the work sample. Current status lives in `STATE.md`; the long form is `docs/portfolio/methodology.md`.

## The situation

Anchorpoint Fire & Safety is a fictional private-equity-backed fire and life-safety operator with a platform branch in Norcross, Georgia and add-ons in Macon, Savannah, and Greenville. Four branches have just been rolled up and the sponsor wants outbound running. The usual move is to buy a list and start sending. The better move is to build the data foundation first: which accounts deserve rep time, which people at those accounts own the problem, and what the CRM has to look like for any of that to be trusted. The client is invented and labelled as such. Its market is real: every Georgia nursing home, every operator behind it, and every fire-safety citation on the public record, sourced from CMS with a retrieval date on each fact.

## The insight

Nursing homes are federally regulated, and CMS publishes every Life Safety Code deficiency with its tag. K0353, sprinkler inspection, testing, and maintenance, is the most cited tag in Georgia at 454 citations, and thirteen tags map directly to the five service lines Anchorpoint sells. Because the record goes back years, the pattern is visible: 45 percent of Georgia facilities were cited for the same fixable tag at two or more inspections. A sprinkler system that keeps failing inspection is a facilities manager who is open to a different vendor. That public signal, not a purchased intent score, is what the whole system is built around.

## The approach

Data foundation first, activation last, and every step a rerunnable script with its rule written down before it runs. Three choices shaped the work.

- Soft targeting over hard ICP tiers. Firmographics contribute gradually; the only hard gates are safety, consent, identity, serviceability, ownership, and human approval. A new owner or a fresh hire is worth more than a perfect-fit account with no reason to act.
- A real market and no fictional history. A made-up CRM can only rediscover the ICP written into it, so the method had to hold up against records I did not control, and it did.
- Safety designed in. Read-only sync, writeback that fills empty fields only and routes every conflict to review, a recorded human approval before any enrollment, deny-first suppression, and a kill switch. The whole path runs to the edge of sending and stops there by construction.

## One lead, end to end

PruittHealth runs 63 buildings in Georgia, 41 of them within reach of a branch. In the CMS file that is 63 rows. The resolver grouped them into one company on the chain identifier, the same rule that grouped 248 of 356 buildings into 28 companies on the first pass, and sent anything ambiguous to a review queue with the evidence attached rather than guessing. Serviceability put a road drive time on every building. The score explained itself in one sentence: footprint in range, repeat sprinkler and alarm citations, recent ownership change. Band A, the top target in the state. One script wrote it to Attio as a Company with 41 Sites. Clay found six people across four role slots, one with a mobile number, and the import wrote the domain, address, and five People back to Attio with every uncertain match queued for a human. A drafting script built a fact sheet from PruittHealth's own citation record and had Claude write one email that names the specific tag and the specific pattern, never a generic pitch. That draft was reviewed and carried into a Lemlist campaign as lead variables for a labelled practice contact. The campaign has no sender and was never launched. Federal data in, explained score out, named contacts under review, a drafted email that stops at a human.

## What was built

- 356 facilities resolved to 105 operators, 71 of them serviceable, tiered into 6 A, 15 B, 32 C, and 18 Watch under a frozen scoring contract, with a separate value estimate that never leaks into the score.
- Attio designed as the system of record: Companies for operators, a custom Site object so facilities never count as accounts, People linked to Companies, and Lists as the only activation audience.
- A deterministic CRM health audit running against a read-only Postgres mirror, with a RevOps dashboard on Vercel where every finding carries a rule and a severity.
- A monthly cron on Render that pulls CMS, resolves, scores, and reloads Attio. The first live run passed all eight stages in six minutes.
- A Lemlist connector with an idempotent enrollment ledger, kill switch, and webhook receiver, verified against the real API.
- Two cold-email drafts with the reasoning behind every line, and three Loom walkthroughs that show the system working.

## What was left

The project was scoped to one day and ran to three. Clay ran on free credits, so the remaining 69 eligible operators wait on a credit decision, and the 142 audit findings their missing domains produce are the next thing to clear. No dialer was bought, so the call handoff ends at an Attio List. The rep work queue and approvals table are designed but not built. The gap statement in `docs/portfolio/gap-statement.md` names each item and what the next engineer does first.

## What it shows

A market can be sized and tiered from public records without inventing anything. A CRM can be loaded and audited by a pipeline that leaves a source and a reason on every row. A cold email can be written from a prospect's own public record. And an activation path can be built all the way to the send button, with approval, suppression, and reversal already in place, before anyone has to decide whether to press it.
