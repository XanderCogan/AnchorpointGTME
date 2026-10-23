# Milestone 6: Lemlist Connector Notes

Status: complete on 2026-10-22, verified on practice fixtures and against the real Lemlist API under decision 0012. The later revision below (Attio source and sender guard) is verified on mocked transport only.

Revised on 2026-10-22 by the user: Anchorpoint runs as a real company, except that no outreach ever happens. The `example.com` lead-domain limit and the single practice test campaign limit are removed; the campaign is chosen per enrollment run. Safety now rests on the launch refusal, the sender guard, the kill switch, and the deny-first plan.

## What exists

- A Lemlist client in `packages/connectors/src/lemlist/` that calls the documented endpoints at `https://api.lemlist.com/api` with Basic auth (empty login, API key as password). Endpoint shapes were taken from developer.lemlist.com on 2026-10-22.
- A guarded transport. It allows only the listed resources and refuses to start a campaign unless `LEMLIST_LAUNCH_ENABLED` is exactly `true`. This project never sets it.
- A sender guard in the transport. Before every lead add and every campaign start, it reads the documented `GET /api/team/senders` endpoint (developer.lemlist.com, retrieved 2026-10-22), which lists each team sender with the campaigns they send for. If any sender lists the target campaign, the write is refused and the enrollment run stops. An unreadable response or a failed read also refuses the write. The check repeats on every write, so a sender attached mid-run still stops it. Gap: the endpoint reports senders by team member; a campaign whose only sender was not listed there would not be caught. No sending infrastructure exists in this project, which is the backstop.
- Deny-first enrollment planning. Every candidate is decided before any write, in this order: kill switch, missing email, suppressed address, suppressed domain, not approved, already enrolled, duplicate in the same request.
- Two input sources. The practice fixture in `fixtures/lemlist-practice-v1/contacts.json` stays for tests. The Attio source (`attio-source.ts`, read by `loadAttioPeopleAndCompanies` in `packages/db/src/attio-mirror.ts`) takes People linked to a mirrored Company; unlinked people are left out and counted. A checked `email_opt_out` becomes a local suppression.
- Approval comes from the application, never from Attio. No approval table exists yet, so the Attio source takes approvals as an explicit input keyed by Attio person record ID (`npm run lemlist:enroll -- --source attio --approvals <file.json>`). Milestone 5's approval table replaces that input later. A person with no approval is planned as `not_approved`.
- Idempotent execution. A ledger key of campaign and lowercased email is claimed before each Lemlist call. Lemlist's `deduplicate=true` and its repeat-add response are treated as results, so retries and concurrent runs cannot add a contact twice. Failed adds can be retried; another-campaign conflicts are final.
- A kill switch that blocks all enrollment locally first, then pauses the campaign in Lemlist.
- Webhook ingestion at `POST /v1/webhooks/lemlist` on the API. Lemlist authenticates only by echoing a shared secret in the body, compared in constant time. Each activity is stored once; unsubscribes and bounces become local suppressions.
- PostgreSQL tables for the ledger, events, suppressions, and activation controls in migration `0004_lemlist.sql`. The revision added no migration.

## Verification

`tests/lemlist-connector.test.ts` covers the deny-first plan for both sources, repeated and concurrent enrollment, a lead Lemlist already holds, retry after failure, the kill switch, the launch refusal, the sender guard (attached, on another campaign, unreadable, unreachable, and on launch with launch enabled), resource scoping, Basic auth, and webhook secret, duplicate, and suppression handling. All Lemlist traffic in tests goes through a mocked transport with fictional `example.com` people.

## Live verification, 2026-10-22

- `npm run lemlist:setup` created the test campaign `cam_9aAovP4kPRAf2gAkf`, "Anchorpoint practice (never launched)", and paused it. Lemlist reports it paused with an empty sender pool, so it cannot send.
- The dry run planned three enrollments and skipped the rest for not approved, duplicate in request, missing email, and suppressed domain. The account has no unsubscribes, so practice-007, suppressed only in the unit test, was planned.
- The first live run enrolled practice-001, practice-002, and practice-007. A second live run enrolled nothing: every approved contact skipped as already enrolled.
- Observed, not investigated: each live run took tens of seconds. The cause is not established; the user deferred debugging it on 2026-10-22.
- Not yet verified live for the revision: the live shape of `GET /api/team/senders` and an enrollment run from the Attio source.

## Webhook, 2026-10-22

Webhook `hoo_6aaLNM5JX3N33S2oX` is registered for the test campaign and delivers to `https://anchorpoint-api-wyaj.onrender.com/v1/webhooks/lemlist` on Render (decision 0013). A synthetic event sent with the shared secret was recorded, a repeat was reported as a duplicate, and a wrong secret was refused with 401. The self-test row has activity ID `act_selftest_20261022`.

## Signal-based drafts, 2026-10-22

Status: built and tested on the committed data; no draft has been generated by the model yet because no `ANTHROPIC_API_KEY` was present when the step was built. The practice run below is pending that key.

### What is built

- A fact-sheet builder, `packages/core/src/draft-inputs.ts`. Given an operator ID and a contact's persona it reads `tiers.json`, `signals.json`, `facility-operator-links.json`, `serviceability.json`, and `web-signals.json` and assembles: the band, score, and explanation sentence; the three to five strongest earned components with their input strings and sources (people-based components that score zero as unknown never appear); every Life Safety Code citation at the operator's in-footprint sites, with the tag code, the CMS wording from the signals tag map, the survey date, the correction flag, and whether that service line was cited on more than one survey; the ownership and management change counts; and the hiring posting candidates. Every fact carries the source string the sample recorded for it, and a fact with no source is dropped. Severity letters, bed counts, account values, and facilities outside the footprint are left out. The only person-level fields are first name, title, and persona.
- A drafting contract, `packages/core/src/draft-copy.ts`: the system prompt, the JSON shape (`subject`, `icebreaker`, `hook_fact`, `body`), a validator, and the review gate.
- `npm run lemlist:draft` (`scripts/lemlist-draft.ts`). It reads the same enrollment input as `lemlist:enroll` (the practice fixture, or the Attio mirror with an approvals file), drafts for approved contacts or for one `--contact`, calls `claude-opus-5-5` once per contact with structured JSON output, runs the validator, and writes `data/georgia-sample/private/drafts/<contactKey>.json` with the fact sheet, the model id, the draft, and empty `reviewedBy` and `reviewedOn` fields. The folder is gitignored. An existing draft is kept unless `--regenerate` is passed. The script prints the subject, hook, and email for review.
- `lemlist:enroll` reads a contact's draft file if one exists. A reviewed draft travels as the Lemlist custom variables `subject`, `icebreaker`, `hook_fact`, `body`, `draftReviewedBy`, and `draftReviewedOn`. A draft without both review fields turns the planned enrollment into a skip (`draft_not_reviewed`). A contact with no draft file enrolls as before. This runs after the deny-first plan and changes none of its decisions.
- The practice fixture gained `practice-008`, a fictional `example.com` person labelled as such, linked to PruittHealth (`ga-op-chain-434`) with the Senior-Living Operations Leader persona and no approval. It exists so the drafter can be run against real signals without touching a real person.

### Guardrails

- The prompt requires under 120 words, exactly one hook naming a public record and its survey date, plain language, no claims about the person, no pricing, no urgency language, no competitors or vendors, no severity letters or values, no mention of ownership changes, hiring, or scoring, and a one-line subject without the word deficiency.
- The validator checks the word count, the subject, urgency and pricing words, em dashes, and that `hook_fact` names a facility, a K tag, and a YYYY-MM-DD survey date that all appear on the fact sheet. Problems are written to the console with the draft; the file is still written so a reviewer can see what the model produced.
- Review is a human act on the file. Nothing in the code fills `reviewedBy` or `reviewedOn`.
- No draft reaches a person or a launched campaign. The campaign stays paused with no sender, `LEMLIST_LAUNCH_ENABLED` is never set, and `lemlist:enroll` is a dry run unless `--live` is passed.

### Verification

`tests/lemlist-drafts.test.ts` builds the PruittHealth sheet from the committed data and asserts that every fact carries a source, that no facility outside the footprint appears, and that the contact block holds only name, title, and persona. It checks the validator on a compliant draft and on each rule break, and checks that enrollment refuses an unreviewed draft and carries a reviewed one as variables, using a hand-written draft in place of a model response.

### Practice draft

Not yet run. When `ANTHROPIC_API_KEY` is in `.env`, run `npm run lemlist:draft -- --contact practice-008` and paste the output here.
