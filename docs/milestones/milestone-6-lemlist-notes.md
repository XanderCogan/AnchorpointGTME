# Milestone 6: Lemlist Connector Notes

Status: complete on 2026-10-22, verified on practice fixtures and against the real Lemlist API under decision 0012. The later revision below (Attio source and sender guard) is verified on mocked transport only. Webhook registration follows the next API deployment.

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

## Remaining

Registering the webhook needs a public HTTPS URL for the API, `LEMLIST_WEBHOOK_SECRET` set on it, and the "Edit integrations" permission. It is not done yet.
