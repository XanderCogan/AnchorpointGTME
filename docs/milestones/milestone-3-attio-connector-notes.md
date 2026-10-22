# Milestone 3 Attio Connector Notes

Status: built and verified against synthetic recorded responses on 2026-10-22. Not accepted. The workspace schema and a read-only token were set up on 2026-10-22 and the live sync is idempotent; acceptance waits for the remaining exit-gate checks below.

## What exists

The read-only connector lives in `packages/connectors/src/attio/` and follows the object mapping in decision 0011. It mirrors workspace members, Companies, the custom Site object, People, Deals, a custom call-log object, and Tasks.

- `transport.ts` is the only path to the API. Attio's record query is a POST that reads, so the guard allows GET on `/v2/self`, `/v2/workspace_members`, and `/v2/tasks`, and POST only on `/v2/objects/{object}/records/query` with a body limited to `filter`, `sorts`, `limit`, and `offset`. Every other method, path, body, or host is refused before the network is reached.
- `client.ts` reads offset pages ordered by creation time, ends on the first short page, fails past a configured page bound, and validates every response with zod.
- `sync.ts` runs a bounded full read of each object. Attio exposes no record-level modified timestamp to filter on, so there is no incremental window; each record's last change is taken from the latest `active_from` across its current values.
- `mirror.ts` holds the change rule: a new record is inserted, an identical payload hash is unchanged, anything else updates. Records a full read no longer returns are counted as missing and kept, never deleted.
- `packages/db/migrations/0003_attio_mirror.sql` and `packages/db/src/attio-mirror.ts` store the mirror in PostgreSQL under a per-connection advisory lock and read it back as a frozen snapshot.
- `packages/core/src/attio-mapping.ts` maps that snapshot onto the CRM-neutral audit model, so `auditCrm` runs unchanged. Missing attributes are reported as gaps and fall back to conservative defaults.

## Mapping choices

- Calls are a custom call-log object (`calls` by default) with occurred-at, disposition, company, person, and deal attributes. Attio tasks have no call type or disposition, and every call must carry a disposition.
- Completed Attio tasks become completed-task activities; Attio records no completion time, so the deadline, else creation time, stands in.
- Only workspace members count as owners. An API token or other actor in an owner attribute is no owner.
- Leads are not mapped. How unmatched inbound hand-raisers are held stays open under decision 0011.

## Verification

All runs use synthetic fixtures derived record for record from `salesforce-mapping-v1` by `scripts/derive-attio-fixtures.ts`. They prove the code runs and are never findings.

- `npm test` passes 58 tests, 15 of them new in `tests/attio-connector.test.ts` and `tests/attio-audit-mapping.test.ts`. `npm run -s typecheck` passes, and `npm run -s inspect` still gives 22 findings, 15 critical and 7 warning.
- `attio-mapping-v1` reproduces all 20 `inspection-v1` rules through the Attio mapping: 21 findings, 15 critical and 6 warning, matching the expectations carried over from `salesforce-mapping-v1`, with no mapping gaps.
- `npm run attio:verify-recorded` passed twice against a scratch PostgreSQL 17 database that was then dropped: 44 records inserted, a resync changed nothing, the changed run updated one company, only reads reached the API, and two snapshot reads had the same checksum.

## Workspace setup

On 2026-10-22 a one-time script, using a separate token scoped only to object configuration, created this schema in `10-x-media`:

1. A custom Site object (`sites`) with a `company` record reference to Companies.
2. A custom call-log object (`call_logs`, set through `ATTIO_CALL_OBJECT`, because Attio reserves `calls`) with `occurred_at` (timestamp), `disposition` (select), and `company`, `person`, and `deal` record references.
3. Custom attributes on Companies: `customer_status` (select), `owner` (workspace member), `target_candidate` (checkbox), and `industry_segment` (select).
4. Custom attributes on People: `owner`, `email_opt_out`, `do_not_call`, `target_candidate`, `persona`, `email_status`, `phone_status`, `enrichment_verified_at`, and `lifecycle_stage`.
5. Custom attributes on Deals: `deal_type` (select) and `next_step` (text).
6. An access token with read-only scopes, stored only in Railway or a local `.env` as `ATTIO_ACCESS_TOKEN`, with `ATTIO_CONNECTION_ID` set.

Select options follow the mapping fixtures: customer status Customer, Former Customer, and Prospect; deal type New Business, Renewal, and Implementation; the seven personas in the operating contract; and the contact status and lifecycle values in `packages/core/src/types.ts`. Call dispositions (Connected, Left voicemail, No answer, Wrong number, Not interested, Meeting booked) are provisional.

Live sync on 2026-10-22 against local PostgreSQL: the first run inserted 1 workspace member and 10 companies; the second run reported every record unchanged. The 10 companies are Attio's default sample records (Apple, Google, and others), not Georgia operators, so they must be removed before the market sample is loaded under decision 0010.

Remaining exit-gate checks: remove the setup token, remove the sample companies, load the Georgia Companies and Sites, run the audit mapping over the mirrored snapshot and resolve any gaps, and confirm in Attio that no record changed during sync.

## Not done

- The CRM history analysis pipeline (`packages/core/src/crm-history.ts`) still reads Salesforce-shaped snapshots. Porting it to the Attio snapshot is separate work.
- List entries, notes, and webhooks are not mirrored.
