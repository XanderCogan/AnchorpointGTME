# Milestone 6: Lemlist Connector Notes

Status: built and verified on practice fixtures on 2026-10-22, under decision 0012. Live verification against the real Lemlist API waits on an API key.

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

## Remaining for live acceptance

1. The user creates a Lemlist API key and sets `LEMLIST_API_KEY` locally.
2. `npm run lemlist:setup` creates the test campaign with auto-review off and pauses it. Its ID goes in `LEMLIST_CAMPAIGN_ID`.
3. `npm run lemlist:enroll` prints the dry-run plan; `npm run lemlist:enroll -- --live` adds the practice leads, and a second live run must add nothing.
4. Unverified until the live run: the created campaign's initial state (the reference example shows `running`; setup pauses it at once, and with no mailbox it has no sender), and whether list endpoints return bare arrays (a wrapped `data` page is also accepted).

Registering the webhook needs a public HTTPS URL for the API and the "Edit integrations" permission; it is not done yet.
