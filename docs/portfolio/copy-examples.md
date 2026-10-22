# Copy Examples: Two Cold-Email Drafts That Were Never Sent

Status: portfolio material, written 2026-10-22. Anchorpoint Fire & Safety is a fictional company (decision 0010). The operators and facilities named below are real Georgia nursing-home operators drawn from public CMS data, which is the agreed design: real market, fictional client. No real person is named, and no person was looked up for this document. Every number comes from `data/georgia-sample/tiers.json`, `signals.json`, `serviceability.json`, and `people-coverage.json`, built from CMS files retrieved on 2026-10-19.

## 1. How the drafts were built

Both drafts follow the path the system would take if it were allowed to run end to end.

- Start from a band A operator in `tiers.json` and read its explanation and components, not a summary of them.
- Pick the persona the role map (`clay-role-map.json`, version 2) says to contact first for that operator, given what the Stage 6 people pass actually found.
- Choose one hook that a public record supports, and name the record.
- Leave out everything the scoring contract treats as a hypothesis about an individual, anything unverified, and anything that sounds like a pitch.
- Keep each email under 120 words.

## 2. Draft A: Journey Healthcare, operations leader

### Why this operator

Journey Healthcare is band A with a score of 47.5 (parameters `georgia-account-proposal-2`, as of 2026-10-19). Its explanation reads: "Band A because Anchorpoint reaches 15 of its 18 footprint sites within 90 minutes, it runs 18 nursing homes within 120 minutes of a capable branch, 82% of those sites were cited for a service line since 2025, sprinkler or alarm deficiencies repeat across surveys, and ownership or management changed recently."

The components behind it:

- Citation repetition is the strongest in band A: 13 of 18 footprint facilities had sprinkler or alarm cited on more than one survey (3.5 of 5 points). Statewide the rate is 41%; Journey's is 69%.
- Citation breadth: 15 of 18 footprint facilities cited for an Anchorpoint service line since 2025 (8.2 of 10).
- Latest service-line citation surveyed 2026-05-20 (4.8 of 6).
- Ownership or management change about 9 months before the scoring date (6.2 of 10). CMS records show ownership changes at 8 facilities and management changes at 9.
- Footprint: 18 Georgia facilities inside the footprint (14.8 of 15), 15 within 90 minutes.
- No maintenance or facilities job posting was found (0 of 8).
- Domain: `journey-hc.com`, a word match only (1 of 2), so the domain needs human confirmation before any send.

### Why this persona

The role map says the regional facilities director is the champion and first contact, and the regional or corporate operations vice president is the economic buyer, contacted first only when no verified facilities person is found. The Stage 6 people pass found two people in the facilities slot but could not verify the persona, and two in the operations slot with persona and current employment verified. So the operations leader is the first contact under the map's own rule. The persona is the Senior-Living Operations Leader added to the operating contract on 2026-10-20.

### The hook and its evidence

The hook is repeat sprinkler maintenance citations across the chain, with one concrete site. Cartersville Crossing of Journey (CCN 115543, 62 minutes from the Norcross branch) was cited under K-0353, sprinkler inspection, testing, and maintenance, at surveys on 2023-01-08, 2024-09-05, and 2026-01-08. Each citation has a recorded correction date. Source: CMS dataset ifjz-ge4w via `signals.json`.

### What was deliberately left out

- The people pass recorded a verified leader who started recently (role change, 10 points). The contract treats tenure as a prioritization hypothesis with visible evidence, not a fact about an individual, so the email does not mention anyone's start date or title.
- The management-change signal. It changes the priority, but citing it to the recipient would read as surveillance.
- Severity letters, bed counts, the account value estimate, and the chain's facilities outside the footprint.
- Any claim about who the current vendor is. That field is `unknown` and was never collected.

### Draft A

Subject: Sprinkler findings repeating across your Georgia buildings

Hello,

I run the Norcross branch of Anchorpoint Fire & Safety. We inspect and maintain sprinkler, alarm, extinguisher, kitchen hood, and emergency lighting systems for multi-site operators in Georgia.

Public CMS surveys show 13 of your 18 Georgia nursing homes in our service area cited for sprinkler or alarm maintenance on more than one survey. Cartersville Crossing, for example, drew K-353 in January 2023, September 2024, and again this January.

That pattern usually means the inspection schedule is split across vendors or deficiency follow-up is not closing.

Would a 30-minute working session mapping inspection coverage across your buildings be useful? Nothing to prepare.

[Rep name]
Anchorpoint Fire & Safety, Norcross

## 3. Draft B: Harborview Health Systems, site administrator

### Why this operator

Harborview Health Systems is band A with a score of 43.9. Its explanation reads: "Band A because Anchorpoint reaches 5 of its 8 footprint sites within 90 minutes, it runs 8 nursing homes within 120 minutes of a capable branch, 64% of those sites were cited for a service line since 2025, sprinkler or alarm deficiencies repeat across surveys, and ownership or management changed recently."

The components behind it:

- Ownership or management change 6 months before the scoring date, the most recent in band A (7.5 of 10).
- Citation repetition: 4 of 8 footprint facilities with sprinkler or alarm cited on more than one survey (2.4 of 5).
- Citation breadth: 5 of 8 footprint facilities cited since 2025 (6.4 of 10).
- Latest service-line citation surveyed 2026-03-19 (4.2 of 6).
- Footprint: 8 facilities inside the footprint (12.4 of 15), 5 within 90 minutes. It is the only band A operator in the Mid value band.
- Domain: the lookup returned `brentwood-health.com`, which is one facility's brand rather than the chain's. That is a data-integrity flag for the review queue, not something to send against.

### Why this persona

The Stage 6 people pass searched both operator-level slots for Harborview and found no one. The role map's site administrator slot (persona: Site Administrator, the licensed nursing home administrator or executive director) is the remaining route. At a chain site the map scores that person as an influencer rather than the owner (7 points under rule `site-admin-split-1`), because corporate or regional facilities usually sets the vendor. The site slots for Harborview were not searched at all (`searched: false` in `people-coverage.json`), so no contact exists for this draft. It is addressed to the role.

### The hook and its evidence

Roselane Health Center by Harborview (CCN 115660, Marietta, 36 minutes from Norcross, fully serviceable) was cited under K-0353 at three consecutive surveys: 2023-06-02, 2024-12-05, and 2026-02-18. Fire alarm was cited at two of those surveys (K-0345 in 2023, K-0341 in 2024). Each has a recorded correction date. Source: CMS dataset ifjz-ge4w via `signals.json`; drive time from `serviceability.json` (OSRM, 2026-10-20).

### What was deliberately left out

- The ownership change six months earlier. It is why the account ranks where it does, but an administrator did not choose it and may be new because of it.
- The other seven Harborview facilities. A site administrator answers for one building.
- Severity letters, and the word "deficiency" in the subject line, which would read as a threat.
- Any claim that the earlier fixes failed. The research note says correction dates record a commitment, not the repair, so the draft does not say that.

### Draft B

Subject: K-353 at Roselane on three surveys running

Hello,

I lead inspections for Anchorpoint Fire & Safety out of Norcross, about 35 minutes from Roselane Health Center.

The public CMS fire-safety file shows Roselane cited for sprinkler inspection, testing, and maintenance (K-353) in June 2023, December 2024, and February 2026. Each has a correction date on record, so this is about the next survey, not the last one.

We do NFPA 25 quarterly and annual work and keep records survey-ready. If it would help, I can walk the building with your maintenance lead before your next window and leave a written gap list, at no charge.

Worth 20 minutes?

[Rep name]
Anchorpoint Fire & Safety

## 4. How a sequence would run under the project rules

The system never sends. If it were allowed to, the path is fixed by the operating contract (v1.3) and decision 0012.

- Hard eligibility first. The operator needs a confirmed root domain, serviceable geography, not-a-customer status, no open opportunity, a CRM owner, and no unresolved critical finding. Today every one of the 71 eligible operators carries two open critical findings in the live audit (no domain and no primary location in Attio), so neither draft could be enrolled.
- Approval before anything. A manager approves the contact, the campaign, and the message version. No approval table exists yet; `npm run lemlist:enroll -- --source attio --approvals <file.json>` takes approvals as an explicit input keyed by Attio person record ID.
- Deny-first suppression. The enrollment planner decides each candidate in order: kill switch, missing email, suppressed address, suppressed domain, not approved, already enrolled, duplicate in the request. The most restrictive signal across Attio, Lemlist, and the local suppression table wins.
- Dry run by default. `lemlist:enroll` plans without writing unless `--live` is passed, and a live run only adds leads to a campaign that is never launched. The sender guard refuses a campaign with an attached sender.
- One channel per contact. Approval picks email or phone; the other channel stays closed until the first play ends.
- Draft B could not enter the queue at all today: no person exists for the Roselane site, and an unnamed role cannot pass the required contact fields.

**These drafts were never sent. No campaign was launched, no mailbox or sending domain exists, and no real person was contacted or looked up for this document.**
