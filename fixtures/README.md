# Synthetic Fixtures

All records in this directory are fictional and use reserved `.example` domains. They must never be presented as customer data or real commercial outcomes.

## Releases

`inspection-v1` is the first immutable HubSpot-shaped CRM audit release. Its input contains owners, companies, contacts, deals, activities, and tasks. Its expected directory contains findings and control totals authored independently from the audit implementation.

Do not edit an approved release in place. Create a new release when adding or changing scenarios so historical inspection evidence remains reproducible.

`salesforce-mapping-v1` is its Salesforce-shaped counterpart: synthetic mirror records and a mapping configuration that reproduce every `inspection-v1` rule through the Salesforce mapping, with independently authored expected findings. It was built under decision 0005 and is superseded by decision 0011. `attio-mapping-v1` is its Attio-shaped counterpart, derived record for record by `scripts/derive-attio-fixtures.ts`, and `connectors/attio-recorded-v1` holds the matching synthetic Attio API responses.

Generated findings belong under `artifacts/` and are not source fixtures.


## Connector recordings

`connectors/salesforce-recorded-v1` holds hand-written, synthetic Salesforce REST query responses for the superseded Salesforce connector tests. They follow the same rules: fictional, reserved domains, and never edited in place once tests depend on them.

## Analysis fixtures

`analysis/crm-history-test-v1` is a synthetic CRM history, billing, and market input for the CRM history analysis pipeline, with test dispositions standing in for a client's sign-off. Its outputs prove the pipeline runs. They are never findings, market evidence, or Anchorpoint history (decision 0010).
