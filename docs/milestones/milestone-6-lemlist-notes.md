# Milestone 6: Lemlist Connector Notes

Status: built and verified on practice fixtures and against the real Lemlist API on 2026-10-22, under decision 0012. Webhook registration is the one open item.

## What exists

- A Lemlist client in `packages/connectors/src/lemlist/` that calls the documented endpoints at `https://api.lemlist.com/api` with Basic auth (empty login, API key as password). Endpoint shapes were taken from developer.lemlist.com on 2026-10-22.
- A guarded transport. It allows only the listed resources, limits lead and campaign-state writes to the one configured test campaign, limits leads to allowed email domains (default `example.com` and its subdomains), and refuses to start a campaign unless `LEMLIST_LAUNCH_ENABLED` is exactly `true`. This project never sets it.
- Deny-first enrollment planning. Every candidate is decided before any write, in this order: kill switch, missing email, suppressed address, suppressed domain, not approved, already enrolled, duplicate in the same request.
- Idempotent execution. A ledger key of campaign and lowercased email is claimed before each Lemlist call. Lemlist's `deduplicate=true` and its repeat-add response are treated as results, so retries and concurrent runs cannot add a contact twice. Failed adds can be retried; another-campaign conflicts are final.
- A kill switch that blocks all enrollment locally first, then pauses the campaign in Lemlist.
- Webhook ingestion at `POST /v1/webhooks/lemlist` on the API. Lemlist authenticates only by echoing a shared secret in the body, compared in constant time. Each activity is stored once; unsubscribes and bounces become local suppressions.
- PostgreSQL tables for the ledger, events, suppressions, and activation controls in migration `0004_lemlist.sql`.
- Practice contacts in `fixtures/lemlist-practice-v1/contacts.json`, fictional and at `example.com` addresses.

## Verification

`tests/lemlist-connector.test.ts` covers the deny-first plan, repeated and concurrent enrollment, a lead Lemlist already holds, retry after failure, the kill switch, the launch refusal, write scoping, Basic auth, and webhook secret, duplicate, and suppression handling.

## Live verification, 2026-10-22

- `npm run lemlist:setup` created the test campaign `cam_9aAovP4kPRAf2gAkf`, "Anchorpoint practice (never launched)", and paused it. Lemlist reports it paused with an empty sender pool, so it cannot send.
- The dry run planned three enrollments and skipped the rest for not approved, duplicate in request, missing email, and suppressed domain. The account has no unsubscribes, so practice-007, suppressed only in the unit test, was planned.
- The first live run enrolled practice-001, practice-002, and practice-007. A second live run enrolled nothing: every approved contact skipped as already enrolled.
- Observed, not investigated: each live run took tens of seconds. The cause is not established.

## Remaining

Registering the webhook needs a public HTTPS URL for the API, `LEMLIST_WEBHOOK_SECRET` set on it, and the "Edit integrations" permission. It is not done yet.
