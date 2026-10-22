# Attio Enrichment Writeback Notes

Status: built and verified on synthetic fixtures; live use needs a scoped write token the user creates. No live Attio call was made.

## Why

The user decided Anchorpoint runs as a real company, so Clay enrichment results must reach Attio. The Milestone 3 sync connector stays read-only by construction; writeback is a separate path with its own token and its own transport guard.

## What exists

- `packages/connectors/src/attio/writeback-transport.ts` is the only write path. It allows POST `/v2/objects/people/records` with exactly one Company link and a name, and PATCH `/v2/objects/{people|companies}/records/{id}` limited to whitelisted attributes. Reads, deletes, asserts, other objects, other attributes, query strings, extra body keys, and other hosts are refused before the network is reached.
- Whitelisted Company attributes: `domains`, `primary_location`.
- Whitelisted Person attributes: `name`, `job_title`, `email_addresses`, `linkedin`, `persona`, `persona_verified`, `enrichment_source`, `enrichment_date`, plus `company` on create only. A PATCH can never relink a person.
- `packages/connectors/src/attio/writeback.ts` plans writes from current Attio records, the enrichment rows, and a local ledger, then applies them. `dryRun` returns the full plan without touching the transport or the store.
- `packages/db/migrations/0005_attio_writeback.sql` and `packages/db/src/attio-writeback.ts` hold the ledger of written values, the people this path created, and the review queue.
- `ATTIO_WRITEBACK_TOKEN` configures the path. It must differ from `ATTIO_ACCESS_TOKEN` and needs `ATTIO_CONNECTION_ID`.

## Write policy

- An empty field is filled.
- A single-valued field still holding the value this writeback last wrote may be refreshed.
- Any other differing value is treated as human-entered, kept, and queued for review. Multi-valued fields (domains, emails) append on PATCH, so any differing existing value goes to review.
- Routed to review with no write: an unconfirmed identity match, an unknown Company, a named person who is missing or linked to a different Company, and a possible duplicate (same email anywhere, or same name at the same Company).
- An unverified persona is queued for review and neither `persona` nor `persona_verified` is written; other fields still fill.
- Provenance (`enrichment_source`, `enrichment_date`) is stamped only when a substantive value is written.
- Rerunning the same input makes no request and queues nothing new: values compare after normalization, created people are found through the ledger by source key, and review items have deterministic keys.
- People are created, not asserted, because an Attio assert on email can overwrite a record the plan has not seen; a unique-email clash then fails instead of overwriting.

## Before live use

- The user creates an Attio token scoped to record read-write only and stores it as `ATTIO_WRITEBACK_TOKEN`.
- Custom People attributes `persona_verified` (checkbox), `enrichment_source` (text), and `enrichment_date` (date) do not exist in the workspace yet; `persona` does.
- Migration 0005 must be applied, and a runner script that reads current state from the mirror and feeds Clay output is not built.
- The operating contract's write policy still limits later writes to custom attributes, Tasks, and List entries; creating People and setting standard attributes needs that document updated when the user approves this path.

## Verification

`tests/attio-writeback.test.ts` runs against an in-memory synthetic Attio with fictional example.com people and covers scope refusal, fill-empty, conflict to review, duplicate to review, unverified persona to review, uncertain match, idempotent rerun, and dry run.
