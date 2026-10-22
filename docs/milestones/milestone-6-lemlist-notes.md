# Milestone 6: Lemlist Connector Notes

Status: built and verified on fixtures and mocked transport on 2026-10-22, under decision 0012. Live verification against the real Lemlist API waits on an API key.

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

## Remaining for live acceptance

1. The user creates a Lemlist API key and sets `LEMLIST_API_KEY` locally.
2. `npm run lemlist:setup` creates a campaign with auto-review off and pauses it. Its ID goes in `LEMLIST_CAMPAIGN_ID`, or is passed with `--campaign`.
3. `npm run lemlist:enroll` prints the dry-run plan; `--live` adds the planned leads, and a second live run must add nothing. Any live write still needs the user's OK under decision 0012.
4. Unverified until the live run: the created campaign's initial state, whether list endpoints return bare arrays (a wrapped `data` page is also accepted), and the live shape of `GET /api/team/senders`.

Registering the webhook needs a public HTTPS URL for the API and the "Edit integrations" permission; it is not done yet.
