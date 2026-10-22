# Milestone 3 Salesforce Connector Notes

Status: superseded on 2026-10-21 by decision 0011, which moves the CRM to Attio. This groundwork was built and verified against synthetic recorded responses on 2026-10-20 and was never accepted. It is kept as reference for the Attio connector's read-only transport, paging, and mirror rules, and is not Milestone 3 evidence.

## What exists

The read-only connector lives in `packages/connectors/src/salesforce/`. It mirrors Account, the provisional `Site__c` custom object, Contact, Lead, Opportunity, User, Task, and Campaign, following the object mapping in decision 0005.

- `transport.ts` is the only path to the data API. It refuses any method other than GET, any host other than the org's instance URL, any endpoint other than the REST query resource and its `nextRecordsUrl` continuation pages, and any SOQL that does not start with SELECT. Refusal happens before the network is reached.
- `client.ts` exposes one method, `queryPages`, which follows `nextRecordsUrl` until Salesforce reports `done` and fails if a configured page bound is exceeded. Every page is validated with zod at the boundary.
- `sync.ts` runs a bounded incremental window per object: `SystemModstamp` from the stored watermark (or a required initial date) up to a fixed upper bound, ordered by `SystemModstamp` and `Id`, with a SOQL `LIMIT`. The lower bound is inclusive, so boundary records are re-read and classified as unchanged. If the limit truncates a window, the next run resumes from the last `SystemModstamp` read. Live runs hold the upper bound two minutes behind now, because Salesforce can commit a record with a slightly earlier `SystemModstamp`.
- `mirror.ts` holds the one change rule: a new record is inserted, an identical payload hash is unchanged, an older `SystemModstamp` is stale and ignored, and anything else updates. The hash excludes `attributes`, whose URL embeds the API version.
- `auth.ts` and `config.ts` support the OAuth 2.0 client credentials flow and the JWT bearer flow. The token exchange is the connector's only POST, sent only to `/services/oauth2/token` on the configured login host. Configuration comes from environment variables listed in `.env.example`; none are set and no secret is in git.

The PostgreSQL boundary is `packages/db/src/salesforce-mirror.ts` with migration `0002_salesforce_mirror.sql`. It stores each record's payload exactly as received, so the original `CreatedDate`, `LastModifiedDate`, and `SystemModstamp` strings survive, alongside normalized `timestamptz` columns. Each object batch applies in one transaction under a per-connection advisory lock, and a watermark that moved during the fetch aborts the batch. Every batch writes a `salesforce_sync_runs` row with its window and counts.

Synthetic recorded responses are in `fixtures/connectors/salesforce-recorded-v1/`. They are hand-written to the documented response shape, contain no real people or companies, and are labelled synthetic in every manifest.

## Verification

- `npm test` includes 13 connector tests in `tests/salesforce-connector.test.ts`. They cover pagination across `nextRecordsUrl`, the SOQL window and limit, the page bound, idempotent resync with no writes and no watermark movement, incremental windows, stale replay, exact timestamp preservation, concurrent-watermark refusal, refusal of POST, PATCH, PUT, DELETE, HEAD, OPTIONS and non-query GETs with zero network calls, the absence of write methods, configuration validation, JWT signing, and the token endpoint.
- `npm run salesforce:verify-recorded` runs the same scenarios through PostgreSQL. On 2026-10-20 it passed twice in a row against a scratch database in the local PostgreSQL 17 container: 17 inserts, a full resync with 0 changes, then 1 update and 1 unchanged boundary record in the incremental window, with all 30 requests GET. The scratch database was dropped afterwards.
- `npm run -s typecheck` and `npm run -s inspect` (22 findings: 15 critical, 7 warning) still pass.

## What still needs the real org

1. The Developer Edition org itself, holding the Georgia operators from the market sample.
2. The Site custom object. The connector assumes `Site__c` with an `Account__c` lookup; decision 0005 still leaves open whether Sites are custom objects or Field Service Locations. `SALESFORCE_SITE_OBJECT` overrides the API name, and the field list is in `objects.ts`.
3. A dedicated integration user with the API Only permission and a permission set granting Read on the eight objects and nothing more: no Create, Edit, Delete, View All Data, or Modify All Data. This is the org-side half of the read-only guarantee.
4. An External Client App or Connected App for that user, with either the client credentials flow enabled and the integration user as its run-as user, or a certificate uploaded for the JWT bearer flow. The private key stays outside the repository.
5. Confirmation that the default API version `v62.0` and every listed field are available in the org. A missing field makes the whole query fail.
6. Environment variables set locally, then in Railway once approved. Nothing has been deployed.

## Exit-gate checks still pending

- Run `npm run salesforce:sync` twice against the org with no edits in between and confirm the second run reports 0 inserted and 0 updated for every object.
- Prove no Salesforce records changed: record `SystemModstamp` and `LastModifiedById` for every mirrored record before and after the syncs, and confirm the integration user appears in no record's `LastModifiedById` and in no Setup Audit Trail entry.
- Confirm in Setup that the integration user's effective permissions are read-only.

## Known limits

- Deleted records are not detected. That needs `queryAll` with `IsDeleted` or the `getDeleted` resource, both reads, in a later change.
- Campaign Members and Events are not mirrored yet, although decision 0005 maps them.
- The sync is not yet a worker job; it runs from `npm run salesforce:sync`.
